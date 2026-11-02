import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const folder = dirname(fileURLToPath(import.meta.url));
const root = join(folder, '..');
const domain = 'https://betgpt.live';
const modelVersion = 'BetGPT-POISSON-CONTINUITY-V1';
const leagues = {
  'fra.1': 'Ligue 1',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
  'ger.1': 'Bundesliga',
  'ita.1': 'Serie A',
  'uefa.champions': 'Ligue des champions',
  'uefa.europa': 'Ligue Europa',
  'ned.1': 'Eredivisie',
  'por.1': 'Liga Portugal',
};
const read = (name, fallback) => {
  try { return JSON.parse(readFileSync(join(root, name), 'utf8')); }
  catch { return fallback; }
};
const ledger = read('data/editorial/ledger.json', []);
const originalArchive = read('data/live-snapshot.json', { matches: [] });
const articles = ledger.filter(item =>
  ['PUBLISHED', 'UPDATED'].includes(item.status) && item.quality?.pass &&
  item.slug && item.h1 && item.paragraphs?.length
).sort((a, b) => Date.parse(b.publishedAt || b.createdAt || 0) -
  Date.parse(a.publishedAt || a.createdAt || 0));
const articleBySlug = new Map(articles.map(item => [item.slug, item]));
const archivedGames = (originalArchive.matches || []).filter(item =>
  item.status === 'finished' && item.slug && item.home?.name && item.away?.name &&
  Number.isFinite(item.scoreHome) && Number.isFinite(item.scoreAway)
).slice(0, 80);
const gameBySlug = new Map(archivedGames.map(item => [item.slug, item]));
const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 6000,
      idleTimeoutMillis: 30000,
    })
  : null;
let cache = null;
let inflight = null;
let storedAt = 0;
let databaseError = '';
const yyyyMMdd = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const htmlEscape = v => String(v ?? '').replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const dayFr = v => {
  const date = new Date(v || '2026-10-01');
  return Number.isFinite(date.getTime()) ?
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : '';
};
const asset = path => {
  const p = String(path || '/desk-hero.jpg');
  if (p.startsWith('/') && !p.includes('..')) {
    return 'https://raw.githubusercontent.com/Dr-starck66/betgpt-railway/main/public' + p;
  }
  return /^https:\/\//.test(p) ? p : '';
};

export function parseEvent(event, league) {
  const c = event?.competitions?.[0];
  const list = c?.competitors || [];
  const h = list.find(x => x.homeAway === 'home');
  const a = list.find(x => x.homeAway === 'away');
  if (!h || !a || !event?.date || !event?.id) return null;
  const state = c?.status?.type?.state;
  const status = state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming';
  const score = value => value !== null && value !== undefined && String(value) !== '' &&
    Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    id: String(event.id),
    league,
    competition: leagues[league] || league,
    kickoff: event.date,
    status,
    scoreHome: status === 'upcoming' ? null : score(h.score),
    scoreAway: status === 'upcoming' ? null : score(a.score),
    clock: status === 'live' ? String(c?.status?.displayClock || '') : '',
    home: {
      id: String(h.team?.id || ''),
      name: h.team?.displayName || h.team?.name || '?',
      logo: h.team?.logo || '',
    },
    away: {
      id: String(a.team?.id || ''),
      name: a.team?.displayName || a.team?.name || '?',
      logo: a.team?.logo || '',
    },
    source: 'ESPN',
  };
}

export function goalMatrix(lambdaHome, lambdaAway) {
  const probability = lambda => {
    const arr = [Math.exp(-lambda)];
    for (let i = 1; i <= 8; i++) arr.push(arr[i - 1] * lambda / i);
    return arr;
  };
  const hp = probability(lambdaHome);
  const ap = probability(lambdaAway);
  let total = 0;
  let home = 0;
  let draw = 0;
  let away = 0;
  let over25 = 0;
  let btts = 0;
  const outcomes = [];
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const p = hp[i] * ap[j];
      total += p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      if (i + j >= 3) over25 += p;
      if (i > 0 && j > 0) btts += p;
      outcomes.push({ home: i, away: j, probability: p });
    }
  }
  outcomes.sort((a, b) => b.probability - a.probability);
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
    over25: over25 / total,
    btts: btts / total,
    topScores: outcomes.slice(0, 3).map(x => ({
      ...x, probability: x.probability / total,
    })),
  };
}

export function estimate(event, standings, league) {
  const match = parseEvent(event, league);
  if (!match || match.status !== 'upcoming') return { error: 'match_not_upcoming' };
  const entries = (standings?.children || []).flatMap(row => row.standings?.entries || []);
  const teams = entries.map(entry => {
    const stats = Object.fromEntries((entry.stats || []).map(stat => [
      stat.name, Number(stat.value),
    ]));
    return {
      id: String(entry.team?.id || ''),
      name: entry.team?.displayName || entry.team?.name,
      games: Number.isFinite(stats.gamesPlayed) ? stats.gamesPlayed : 0,
      scored: Number.isFinite(stats.pointsFor) ? stats.pointsFor : 0,
      conceded: Number.isFinite(stats.pointsAgainst) ? stats.pointsAgainst : 0,
    };
  }).filter(team => team.games > 0);
  const home = teams.find(team => team.id === match.home.id);
  const away = teams.find(team => team.id === match.away.id);
  if (!home || !away || teams.length < 8)
    return { error: 'insufficient_team_or_league_statistics', count: teams.length };
  const games = teams.reduce((n, team) => n + team.games, 0);
  const avgFor = teams.reduce((n, team) => n + team.scored, 0) / games;
  const avgAgainst = teams.reduce((n, team) => n + team.conceded, 0) / games;
  if (!(avgFor > 0 && avgAgainst > 0)) return { error: 'invalid_scoring_average' };
  const shrink = (goals, n, prior) => (goals + 4 * prior) / (n + 4);
  const clamp = n => Math.max(0.2, Math.min(4, n));
  const lh = clamp(shrink(home.scored, home.games, avgFor) *
    shrink(away.conceded, away.games, avgAgainst) / avgAgainst * 1.09);
  const la = clamp(shrink(away.scored, away.games, avgFor) *
    shrink(home.conceded, home.games, avgAgainst) / avgAgainst * 0.91);
  return {
    status: 'PASS',
    model: modelVersion,
    method: 'Matrice Poisson 0-rho, modèle de secours non calibré',
    source: 'ESPN season standings',
    asOf: new Date().toISOString(),
    league,
    eventId: match.id,
    home: home.name,
    away: away.name,
    kickoff: match.kickoff,
    confidence: home.games >= 6 && away.games >= 6 ? 'SAMPLE_OK' : 'LOW_SAMPLE',
    sample: { homeGames: home.games, awayGames: away.games, leagueTeams: teams.length },
    lambdaHome: lh,
    lambdaAway: la,
    probabilities: goalMatrix(lh, la),
  };
}

async function upstream(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new Error('ESPN HTTP ' + response.status);
  const data = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid ESPN response');
  return data;
}
async function scoreboard(league, date) {
  const data = await upstream('https://site.api.espn.com/apis/site/v2/sports/soccer/' +
    encodeURIComponent(league) + '/scoreboard?dates=' + date + '&limit=100');
  if (!Array.isArray(data.events)) throw new Error('ESPN events absent');
  return data.events;
}
async function dbQuery(sql, args = []) {
  if (!pool) throw new Error('DATABASE_URL not configured');
  try {
    const result = await pool.query(sql, args);
    databaseError = '';
    return result;
  } catch (cause) {
    databaseError = String(cause?.message || cause).slice(0, 100);
    throw cause;
  }
}
async function initDatabase() {
  if (!pool) return;
  await dbQuery(
    'CREATE TABLE IF NOT EXISTS betgpt_score_snapshots (' +
    'id BIGSERIAL PRIMARY KEY, source TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL, ' +
    'match_count INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0, ' +
    'payload JSONB NOT NULL, inserted_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  await dbQuery(
    'CREATE TABLE IF NOT EXISTS betgpt_prediction_snapshots (' +
    'id TEXT PRIMARY KEY, captured_at TIMESTAMPTZ NOT NULL, model TEXT NOT NULL, ' +
    'payload JSONB NOT NULL, inserted_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
}
const dbReady = pool ? initDatabase().catch(cause => {
  databaseError = String(cause?.message || cause).slice(0, 100);
}) : Promise.resolve();

async function persistScores(value) {
  if (!pool || Date.now() - storedAt < 600000) return;
  await dbReady;
  await dbQuery(
    'INSERT INTO betgpt_score_snapshots (source, captured_at, match_count, failures, payload) ' +
    'VALUES ($1, $2, $3, $4, $5::jsonb)',
    ['ESPN', value.asOf, value.total, value.nFailures, JSON.stringify(value)]
  );
  storedAt = Date.now();
}
async function scores() {
  if (cache && Date.now() - cache.savedAt < 90000) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    const noon = new Date();
    noon.setUTCHours(12, 0, 0, 0);
    const dates = [-1, 0, 1, 2].map(off => new Date(noon.getTime() + off * 86400000));
    const requests = Object.keys(leagues).flatMap(league =>
      dates.map(date => ({ league, day: yyyyMMdd(date) })));
    const replies = await Promise.all(requests.map(async item => {
      try { return { ...item, events: await scoreboard(item.league, item.day) }; }
      catch (cause) { return { ...item, error: String(cause?.message || cause).slice(0, 90) }; }
    }));
    const failures = replies.filter(row => row.error).map(row =>
      ({ league: row.league, day: row.day, error: row.error }));
    const seen = new Set();
    const matches = replies.flatMap(row =>
      (row.events || []).map(event => parseEvent(event, row.league))
    ).filter(match => {
      if (!match) return false;
      const id = match.league + ':' + match.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    if (!matches.length) {
      if (pool) {
        try {
          const saved = await dbQuery(
            'SELECT payload, captured_at FROM betgpt_score_snapshots ORDER BY id DESC LIMIT 1'
          );
          if (saved.rows[0]) {
            return {
              ...saved.rows[0].payload, status: 'STALE', stale: true,
              archivedAt: saved.rows[0].captured_at, failures,
            };
          }
        } catch { /* no fake scores */ }
      }
      throw new Error('ESPN score service unavailable');
    }
    const payload = {
      source: 'ESPN',
      status: failures.length ? 'PARTIAL' : 'PASS',
      stale: false,
      asOf: new Date().toISOString(),
      total: matches.length,
      nFeeds: requests.length,
      nFailures: failures.length,
      failures: failures.slice(0, 12),
      matches,
    };
    if (pool) {
      try {
        await persistScores(payload);
        payload.persistence = 'STORED_OR_RECENT';
      } catch {
        payload.persistence = 'FAIL';
      }
    } else payload.persistence = 'UNCONFIGURED';
    cache = { savedAt: Date.now(), value: payload };
    return payload;
  })().finally(() => { inflight = null; });
  return inflight;
}
async function predict(league, eventId, day) {
  if (!Object.hasOwn(leagues, league) || !/^\d{6,15}$/.test(eventId) || !/^\d{8}$/.test(day))
    return { error: 'invalid_arguments', statusCode: 400 };
  const [events, standings] = await Promise.all([
    scoreboard(league, day),
    upstream('https://site.web.api.espn.com/apis/v2/sports/soccer/' +
      encodeURIComponent(league) + '/standings?region=us&lang=en'),
  ]);
  const event = events.find(row => String(row.id) === eventId);
  if (!event) return { error: 'event_not_found', statusCode: 404 };
  const prediction = estimate(event, standings, league);
  if (prediction.error) return { ...prediction, statusCode: 503 };
  if (pool) {
    try {
      await dbReady;
      const id = [league, eventId, day, modelVersion].join(':');
      await dbQuery(
        'INSERT INTO betgpt_prediction_snapshots (id, captured_at, model, payload) ' +
        'VALUES ($1, $2, $3, $4::jsonb) ' +
        'ON CONFLICT(id) DO UPDATE SET captured_at=EXCLUDED.captured_at, payload=EXCLUDED.payload',
        [id, prediction.asOf, modelVersion, JSON.stringify(prediction)]
      );
      prediction.persistence = 'STORED';
    } catch { prediction.persistence = 'FAIL'; }
  } else prediction.persistence = 'UNCONFIGURED';
  return prediction;
}
const css = readFileSync(join(folder, 'site.css'), 'utf8');
const liveJS = readFileSync(join(folder, 'live.js'), 'utf8');
const nav = '<header class="top"><div class="wrap nav"><a class="brand" href="/">Bet<b>GPT</b> ⚽</a><nav>' +
  '<a href="/">Accueil</a><a href="/actualites">Actualités</a><a href="/scores-en-direct">Scores</a>' +
  '<a href="/pronostics-football">Pronostics</a><a href="/resultats-football">Archives</a></nav></div></header>';
function page(req, title, description, pathname, body) {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const robots = host === 'betgpt.live' || host === 'www.betgpt.live'
    ? 'index,follow' : 'noindex,follow';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="' + robots + '">' +
    '<title>' + htmlEscape(title) + ' | BetGPT</title>' +
    '<meta name="description" content="' + htmlEscape(description).slice(0, 215) + '">' +
    '<link rel="canonical" href="' + domain + pathname + '">' +
    '<link rel="stylesheet" href="/site.css"></head><body>' + nav +
    '<div class="ribbon">Sources ESPN datées · Pronostics Poisson de secours · Aucun score inventé</div>' +
    '<main>' + body + '</main><footer><div class="wrap">© 2026 BetGPT · ' +
    '<a href="/methodology">Méthodologie</a> · Jeux d’argent réservés aux majeurs · ' +
    'Ces estimations ne garantissent aucun résultat.</div></footer></body></html>';
}
function card(a) {
  return '<div class="card"><a href="/actualites/' + encodeURIComponent(a.slug) +
    '"><img loading="lazy" src="' + htmlEscape(asset(a.image?.src)) + '" alt="' +
    htmlEscape(a.image?.alt || 'Football') + '"><div class="body"><span class="label">' +
    htmlEscape(a.category || 'Football') + ' · ' + dayFr(a.publishedAt || a.createdAt) +
    '</span><h3>' + htmlEscape(a.h1) + '</h3><p>' +
    htmlEscape(a.lead).slice(0, 190) + '</p></div></a></div>';
}
function articleBody(a) {
  const text = a.paragraphs.map(p => '<h2>' + htmlEscape(p.h2) + '</h2><p>' +
    htmlEscape(p.body) + '</p>' + (p.subsections || []).map(s =>
      '<h3>' + htmlEscape(s.h3) + '</h3><p>' + htmlEscape(s.body) + '</p>'
    ).join('')).join('');
  const refs = (a.sources || []).filter(s => s?.label).map(s => '<li>' +
    (/^https:\/\//.test(s.url || '') ? '<a rel="nofollow noopener" href="' +
      htmlEscape(s.url) + '">' + htmlEscape(s.label) + '</a>' : htmlEscape(s.label)) +
    '</li>').join('');
  return '<article class="article"><a href="/actualites">← Actualités</a><p class="label">' +
    dayFr(a.publishedAt || a.createdAt) + '</p><h1>' + htmlEscape(a.h1) +
    '</h1><p>' + htmlEscape(a.lead) + '</p>' +
    '<div class="callout">Article historique : vérifier sa date avant usage.</div>' +
    '<figure><img src="' + htmlEscape(asset(a.image?.src)) + '" alt="' +
    htmlEscape(a.image?.alt || '') + '"></figure>' + text +
    (refs ? '<h2>Sources</h2><ul>' + refs + '</ul>' : '') + '</article>';
}
const hero = '<section class="hero"><div class="wrap"><span class="eyebrow">' +
  'FOOTBALL · DIRECT · ANALYSES</span><h1>Le football, les faits et les probabilités.</h1>' +
  '<p>Articles BetGPT originaux, scores réels ESPN et modèle statistique Poisson ' +
  'de continuité, sans cotes inventées.</p>' +
  '<a class="button" href="/scores-en-direct">Scores en direct</a> ' +
  '<a class="button" href="/pronostics-football">Pronostics</a></div></section>';
const liveBody = '<section class="hero"><div class="wrap"><span class="eyebrow">' +
  'FOOTBALL · ESPN · PROBABILITÉS</span><h1>Scores football et calculs 1/N/2</h1>' +
  '<p>Rencontres vérifiées et datées. Le moteur Poisson de secours utilise ' +
  'les statistiques de saison ESPN et n’est pas le moteur avancé historique.</p>' +
  '<div class="callout">Aucune cote ni aucune rentabilité n’est inventée. ' +
  'Les estimations ne garantissent aucun gain.</div><p id="live-status" class="small">' +
  'Chargement des données ESPN…</p></div></section>' +
  '<section class="wrap section"><div class="toolbar">' +
  '<button class="active" data-filter="all">Tous</button>' +
  '<button data-filter="live">En direct</button>' +
  '<button data-filter="upcoming">À venir</button>' +
  '<button data-filter="finished">Terminés</button></div>' +
  '<div id="match-grid" class="grid"></div></section><script src="/live.js" defer></script>';
function archiveBody() {
  const rows = archivedGames.map(m => '<tr><td>' + dayFr(m.kickoff) +
    '</td><td><a href="/match/' + encodeURIComponent(m.slug) + '">' +
    htmlEscape(m.home.name) + ' — ' + htmlEscape(m.away.name) +
    '</a></td><td>' + m.scoreHome + '–' + m.scoreAway + '</td></tr>').join('');
  return '<section class="wrap section"><h1>Archives des résultats</h1>' +
    '<div class="callout">Dernière capture historique : ' +
    dayFr(originalArchive.fetchedAt) + '. Les scores ne sont pas du direct.</div>' +
    '<div class="panel"><table class="table"><thead><tr><th>Date</th>' +
    '<th>Match</th><th>Score final</th></tr></thead><tbody>' + rows +
    '</tbody></table></div></section>';
}
function send(res, statusCode, value, contentType = 'text/html; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': contentType.startsWith('application/json') ? 'no-store' : 'public,max-age=45',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(value);
}
const sendJson = (res, code, value) =>
  send(res, code, JSON.stringify(value), 'application/json; charset=utf-8');
async function handle(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const url = new URL(req.url || '/', 'https://betgpt.live');
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/site.css') return send(res, 200, css, 'text/css; charset=utf-8');
  if (path === '/live.js') return send(res, 200, liveJS, 'text/javascript; charset=utf-8');
  if (path === '/robots.txt') return send(res, 200,
    'User-agent: *\nAllow: /\nSitemap: https://betgpt.live/sitemap.xml\n',
    'text/plain; charset=utf-8');
  if (path === '/sitemap.xml') {
    const paths = ['/', '/actualites', '/scores-en-direct', '/pronostics-football',
      '/resultats-football', '/methodology',
      ...articles.map(a => '/actualites/' + a.slug),
      ...archivedGames.map(m => '/match/' + m.slug)];
    return send(res, 200,
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      paths.map(p => '<url><loc>' + domain + htmlEscape(p) + '</loc></url>').join('') +
      '</urlset>', 'application/xml; charset=utf-8');
  }
  if (path === '/api/health') {
    let database = 'UNCONFIGURED';
    if (pool) {
      try { await dbReady; await dbQuery('SELECT 1'); database = 'PASS'; }
      catch { database = 'FAIL'; }
    }
    return sendJson(res, 200, {
      service: 'BetGPT continuity',
      status: database === 'PASS' ? 'PASS' : 'PARTIAL',
      database,
      asOf: new Date().toISOString(),
      model: modelVersion,
      articles: articles.length,
      archivedMatches: archivedGames.length,
    });
  }
  if (path === '/api/scores') {
    try { return sendJson(res, 200, await scores()); }
    catch (cause) {
      return sendJson(res, 503, { status: 'FAIL', error: 'ESPN_unavailable',
        detail: String(cause?.message || cause).slice(0, 120) });
    }
  }
  if (path === '/api/predict') {
    try {
      const result = await predict(
        url.searchParams.get('league') || '',
        url.searchParams.get('eventId') || '',
        url.searchParams.get('date') || yyyyMMdd(new Date())
      );
      return sendJson(res, result.statusCode || 200, result);
    } catch (cause) {
      return sendJson(res, 503, { status: 'FAIL', error: 'prediction_unavailable',
        detail: String(cause?.message || cause).slice(0, 120) });
    }
  }
  if (path === '/api/snapshots') {
    if (!pool) return sendJson(res, 503, { error: 'database_not_configured' });
    try {
      await dbReady;
      const result = await dbQuery(
        'SELECT id, captured_at, match_count, failures, inserted_at ' +
        'FROM betgpt_score_snapshots ORDER BY id DESC LIMIT 12'
      );
      return sendJson(res, 200, { status: 'PASS', persistence: 'POSTGRES',
        items: result.rows });
    } catch { return sendJson(res, 503, { error: 'database_unavailable' }); }
  }
  if (path === '/') return send(res, 200, page(req, 'Football, résultats et analyses',
    'Football, scores ESPN, pronostics et archives éditoriales BetGPT.', '/',
    hero + '<section class="wrap section"><h2>Dernières actualités</h2><div class="grid">' +
    articles.slice(0, 9).map(card).join('') + '</div><p><a href="/actualites">' +
    'Tous les articles</a></p></section>'));
  if (path === '/actualites') return send(res, 200, page(req,
    'Actualités football', 'Archives des actualités football de BetGPT.',
    path, '<section class="wrap section"><h1>Actualités football</h1><div class="grid">' +
    articles.map(card).join('') + '</div></section>'));
  if (path === '/scores-en-direct' || path === '/pronostics-football')
    return send(res, 200, page(req,
      path === '/scores-en-direct' ? 'Scores football ESPN' : 'Pronostics football Poisson',
      'Scores football réels et estimations Poisson BetGPT sourcées.',
      path, liveBody));
  if (path === '/resultats-football') return send(res, 200, page(req,
    'Archives des résultats football', 'Résultats datés et historiques.',
    path, archiveBody()));
  if (path === '/methodology') return send(res, 200, page(req,
    'Méthodologie et transparence', 'Données ESPN, estimation Poisson et base PostgreSQL.',
    path, '<section class="wrap section"><h1>Méthodologie</h1><div class="panel">' +
    '<h2>Football</h2><p>Scores et tableaux de saison ESPN. Horodatage et état ' +
    'de collecte visibles dans les réponses de l’API.</p><h2>Probabilités</h2>' +
    '<p>Modèle Poisson 0-rho de secours, non calibré avec l’apprentissage avancé. ' +
    'Pas de cotes bookmakers ni de performances inventées.</p><h2>Persistance</h2>' +
    '<p>La base PostgreSQL n’est considérée comme active qu’après un SELECT ' +
    'réussi et un reçu d’écriture vérifiable.</p></div></section>'));
  if (path.startsWith('/actualites/')) {
    const item = articleBySlug.get(decodeURIComponent(path.slice('/actualites/'.length)));
    if (item) return send(res, 200, page(req,
      item.title || item.h1, item.lead || '', path, articleBody(item)));
  }
  if (path.startsWith('/match/')) {
    const m = gameBySlug.get(decodeURIComponent(path.slice('/match/'.length)));
    if (m) return send(res, 200, page(req, m.home.name + ' ' + m.scoreHome + '–' +
      m.scoreAway + ' ' + m.away.name, 'Score historique, non actualisé.', path,
      '<article class="article"><a href="/resultats-football">← Archives</a>' +
      '<h1>' + htmlEscape(m.home.name) + ' ' + m.scoreHome + '–' + m.scoreAway +
      ' ' + htmlEscape(m.away.name) + '</h1><p>' + dayFr(m.kickoff) + '</p>' +
      '<div class="callout">Résultat historique : ne pas confondre avec le direct.</div></article>'));
  }
  return send(res, 404, page(req, 'Page introuvable', 'Page non disponible.', '/',
    '<section class="wrap section"><h1>Page introuvable</h1>' +
    '<a href="/">Retour à BetGPT</a></section>'));
}

export function start() {
  const port = Number(process.env.PORT || 8080);
  const server = createServer((req, res) => {
    Promise.resolve(handle(req, res)).catch(cause => {
      console.error('[betgpt] unexpected server error:',
        String(cause?.message || cause).slice(0, 100));
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
      else res.end();
    });
  });
  server.listen(port, '0.0.0.0', () => console.log('[betgpt] listening on', port));
  dbReady.then(() => console.log('[betgpt] database configured:', !!pool,
    'error:', databaseError ? 'YES' : 'NONE'));
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) start();
