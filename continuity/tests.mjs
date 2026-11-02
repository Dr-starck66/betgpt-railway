import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

// Tests must not connect to or mutate a live database.
delete process.env.DATABASE_URL;
process.env.PORT = '0';
const { goalMatrix, parseEvent, estimate, start } = await import('./server.mjs');

const soccerEvent = {
  id: '401878762',
  date: '2026-11-03T20:00:00Z',
  competitions: [{
    status: { type: { state: 'pre' } },
    competitors: [
      { homeAway: 'home', team: { id: '1', displayName: 'Newcastle United' } },
      { homeAway: 'away', team: { id: '2', displayName: 'Everton' } },
    ],
  }],
};
const standings = {
  children: [{
    standings: {
      entries: Array.from({ length: 10 }, (_, i) => ({
        team: { id: String(i + 1), displayName: i === 0 ? 'Newcastle United' :
          i === 1 ? 'Everton' : 'Team ' + (i + 1) },
        stats: [
          { name: 'gamesPlayed', value: 8 + (i % 3) },
          { name: 'pointsFor', value: 11 + i },
          { name: 'pointsAgainst', value: 10 + (i % 5) },
        ],
      })),
    },
  }],
};

test('goalMatrix: 1N2 probabilities normalize to one, without guaranteed outcomes', () => {
  const p = goalMatrix(1.4, 1.2);
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  assert.ok(p.over25 > 0 && p.over25 < 1);
  assert.ok(p.btts > 0 && p.btts < 1);
  assert.equal(p.topScores.length, 3);
  assert.ok(p.topScores.every(score => score.probability > 0 && score.probability < 1));
});

test('parseEvent: scheduled fixture cannot invent a 0-0 score', () => {
  const m = parseEvent(soccerEvent, 'eng.1');
  assert.equal(m.status, 'upcoming');
  assert.equal(m.scoreHome, null);
  assert.equal(m.scoreAway, null);
  assert.equal(m.home.name, 'Newcastle United');
});

test('parseEvent: finished result preserves exact reported final score', () => {
  const finished = structuredClone(soccerEvent);
  finished.competitions[0].status.type.state = 'post';
  finished.competitions[0].competitors[0].score = '3';
  finished.competitions[0].competitors[1].score = '1';
  const m = parseEvent(finished, 'eng.1');
  assert.equal(m.status, 'finished');
  assert.equal(m.scoreHome, 3);
  assert.equal(m.scoreAway, 1);
});

test('estimate: real stats shape yields bounded, non-calibrated model result', () => {
  const p = estimate(soccerEvent, standings, 'eng.1');
  assert.equal(p.status, 'PASS');
  assert.equal(p.confidence, 'SAMPLE_OK');
  assert.ok(p.lambdaHome >= 0.2 && p.lambdaHome <= 4);
  assert.ok(p.lambdaAway >= 0.2 && p.lambdaAway <= 4);
  assert.ok(Math.abs(p.probabilities.home + p.probabilities.draw +
    p.probabilities.away - 1) < 1e-9);
});

test('estimate: missing team refuses prediction', () => {
  const broken = structuredClone(standings);
  broken.children[0].standings.entries = broken.children[0].standings.entries
    .filter(row => row.team.id !== '2');
  const p = estimate(soccerEvent, broken, 'eng.1');
  assert.equal(p.error, 'insufficient_team_or_league_statistics');
});

test('HTTP: SEO pages, accessible health and invalid model call without DB', async () => {
  const server = start();
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Football, résultats et analyses/);
    const news = await fetch(base + '/actualites');
    assert.equal(news.status, 200);
    assert.match(await news.text(), /Actualités football/);
    const live = await fetch(base + '/scores-en-direct');
    assert.equal(live.status, 200);
    assert.match(await live.text(), /Calculer|Scores football/);
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.database, 'UNCONFIGURED');
    assert.equal(health.status, 'PARTIAL');
    const invalid = await fetch(base + '/api/predict?league=unknown&eventId=000000');
    assert.equal(invalid.status, 400);
    const sitemap = await fetch(base + '/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(await sitemap.text(), /betgpt.live\/actualites/);
  } finally {
    await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    );
  }
});
