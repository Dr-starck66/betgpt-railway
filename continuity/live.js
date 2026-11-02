const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[char]);
const percent = value => (Math.round(Number(value) * 1000) / 10) + ' %';
let matches = [];
let currentFilter = 'all';
const grid = document.getElementById('match-grid');
const status = document.getElementById('live-status');
const label = state => state === 'live' ? '● EN DIRECT' :
  state === 'finished' ? 'Terminé' : 'À venir';

function teamView(team) {
  const logo = team.logo && /^https:\/\//.test(team.logo) ?
    '<img loading="lazy" src="' + esc(team.logo) + '" alt="">' : '';
  return '<div class="club">' + logo + esc(team.name) + '</div>';
}

function render() {
  const visible = matches.filter(match =>
    currentFilter === 'all' || match.status === currentFilter
  );
  grid.innerHTML = visible.length ? visible.map(match => {
    const uid = match.league + '-' + match.id;
    const button = match.status === 'upcoming' ?
      '<button class="button" data-id="' + esc(match.id) +
      '" data-league="' + esc(match.league) +
      '" data-date="' + esc(match.kickoff.slice(0, 10).replaceAll('-', '')) +
      '">Calculer 1/N/2</button>' +
      '<div class="forecast" id="forecast-' + esc(uid) + '" hidden></div>' : '';
    const score = '<div class="score">' + esc(match.scoreHome ?? '—') +
      ' : ' + esc(match.scoreAway ?? '—') + '</div>';
    return '<article class="card"><div class="body">' +
      '<div class="label">' + esc(match.competition) + ' · ' +
      esc(new Date(match.kickoff).toLocaleString('fr-FR')) +
      '</div><div class="teams">' + teamView(match.home) + score +
      teamView(match.away) + '</div><p class="small">' +
      label(match.status) + '</p>' + button + '</div></article>';
  }).join('') : '<p>Aucune rencontre dans cette catégorie.</p>';
  grid.querySelectorAll('[data-league]').forEach(button =>
    button.addEventListener('click', () => predict(button))
  );
}

async function predict(button) {
  const id = button.dataset.id;
  const league = button.dataset.league;
  const target = document.getElementById('forecast-' + league + '-' + id);
  button.disabled = true;
  target.hidden = false;
  target.textContent = 'Calcul depuis les statistiques réelles ESPN…';
  try {
    const url = '/api/predict?league=' + encodeURIComponent(league) +
      '&eventId=' + encodeURIComponent(id) +
      '&date=' + encodeURIComponent(button.dataset.date);
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.probabilities)
      throw new Error(data.error || 'Données insuffisantes');
    const p = data.probabilities;
    target.innerHTML = '<div class="prob"><span>1 <strong>' +
      percent(p.home) + '</strong></span><span>N <strong>' +
      percent(p.draw) + '</strong></span><span>2 <strong>' +
      percent(p.away) + '</strong></span></div><p>Over 2,5 : ' +
      percent(p.over25) + ' · BTTS : ' + percent(p.btts) +
      '</p><p class="small">' + esc(data.sample.homeGames) +
      ' matchs domicile, ' + esc(data.sample.awayGames) +
      ' extérieur · Poisson non calibré · DB : ' +
      esc(data.persistence) + '</p>';
  } catch (cause) {
    target.textContent = 'Pronostic indisponible : ' + cause.message;
  } finally {
    button.disabled = false;
  }
}

async function load() {
  try {
    const response = await fetch('/api/scores', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.matches))
      throw new Error('Flux ESPN indisponible');
    matches = data.matches;
    status.textContent = data.total + ' rencontres · ESPN relevé ' +
      new Date(data.asOf).toLocaleString('fr-FR') + ' · ' +
      (data.stale ? 'ARCHIVES : le flux est indisponible' : data.status) +
      ' · DB : ' + data.persistence;
    render();
  } catch (cause) {
    status.textContent = 'Aucun score en direct validé : ' + cause.message;
  }
}

document.querySelectorAll('[data-filter]').forEach(button =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(other =>
      other.classList.remove('active')
    );
    button.classList.add('active');
    currentFilter = button.dataset.filter;
    render();
  })
);
load();
setInterval(load, 90000);
