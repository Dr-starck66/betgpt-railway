// @ts-nocheck
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { TEAMS } from "./data";
import { applyAffiliateUrls, isUsOnlyBook, FR_BOOK_RE } from "./affiliates";
import { fetchBookPages, lookupBookPages } from "./book-pages";
import { fetchUnibetBooks, oddsKey, EMPTY_TOTALS, sameFixture, lookupUniBook, type UnibetFixture } from "./eu-odds";
import { clamp } from "./math";
import { matchSlug } from "@/lib/seo";
import { logoFor } from "@/lib/crests";
import { recordScoreDiff } from "@/lib/serp/corrections";
import { hydrateMatchForm } from "./team-form-live";
import type {
  BookOdds,
  HistoricalMatch,
  LeagueId,
  MatchIncident,
  MatchInput,
  MatchStatus,
  TeamProfile,
} from "./types";

const LEAGUES = [
	{
		id: "CL",
		slug: "uefa.champions",
		name: "Ligue des champions"
	},
	{
		id: "EL",
		slug: "uefa.europa",
		name: "Ligue Europa"
	},
	{
		id: "PL",
		slug: "eng.1",
		name: "Premier League"
	},
	{
		id: "LL",
		slug: "esp.1",
		name: "La Liga"
	},
	{
		id: "BL",
		slug: "ger.1",
		name: "Bundesliga"
	},
	{
		id: "SA",
		slug: "ita.1",
		name: "Serie A"
	},
	{
		id: "L1",
		slug: "fra.1",
		name: "Ligue 1"
	},
	{
		id: "ER",
		slug: "ned.1",
		name: "Eredivisie"
	},
	{
		id: "PT",
		slug: "por.1",
		name: "Primeira Liga"
	},
	{
		id: "SC",
		slug: "sco.1",
		name: "Premiership écossaise"
	},
	{
		id: "TR",
		slug: "tur.1",
		name: "Süper Lig"
	},
	{
		id: "NL",
		slug: "uefa.nations",
		name: "Ligue des nations"
	},
	{
		// International bucket: CAF AFCON qualifiers. Keeping NL as the internal
		// LeagueId avoids breaking all league-indexed model tables while preserving
		// the real competition label on each match.
		id: "NL",
		slug: "caf.nations_qual",
		name: "Qualifications Coupe d'Afrique des Nations"
	}
];

const EVENT_ONLY_LEAGUES = [
  { id: "CL", slug: "uefa.champions_qual", name: "Qualifications Ligue des champions" },
  { id: "EL", slug: "uefa.europa_qual", name: "Qualifications Ligue Europa" },
  { id: "EL", slug: "uefa.europa.conf", name: "Ligue Conférence" },
  { id: "EL", slug: "uefa.europa.conf_qual", name: "Qualifications Ligue Conférence" },
  { id: "NL", slug: "uefa.euro", name: "Championnat d'Europe" },
  { id: "NL", slug: "uefa.euroq", name: "Qualifications Euro" },
  { id: "NL", slug: "fifa.world", name: "Coupe du monde" },
  { id: "NL", slug: "fifa.worldq", name: "Qualifications Coupe du monde" },
  { id: "NL", slug: "fifa.worldq.uefa", name: "Qualifications Coupe du monde - UEFA" },
  { id: "NL", slug: "fifa.worldq.caf", name: "Qualifications Coupe du monde - CAF" },
  { id: "NL", slug: "fifa.worldq.afc", name: "Qualifications Coupe du monde - AFC" },
  { id: "NL", slug: "fifa.worldq.concacaf", name: "Qualifications Coupe du monde - CONCACAF" },
  { id: "NL", slug: "fifa.worldq.conmebol", name: "Qualifications Coupe du monde - CONMEBOL" },
  { id: "NL", slug: "caf.nations", name: "Coupe d'Afrique des Nations" },
  { id: "NL", slug: "conmebol.america", name: "Copa América" },
  { id: "NL", slug: "concacaf.gold", name: "Gold Cup" },
  { id: "NL", slug: "afc.asian.cup", name: "Coupe d'Asie" },
  { id: "PL", slug: "eng.fa", name: "FA Cup" },
  { id: "PL", slug: "eng.league_cup", name: "League Cup" },
  { id: "LL", slug: "esp.copa_del_rey", name: "Copa del Rey" },
  { id: "BL", slug: "ger.dfb_pokal", name: "DFB-Pokal" },
  { id: "SA", slug: "ita.coppa_italia", name: "Coupe d'Italie" },
  { id: "L1", slug: "fra.coupe_de_france", name: "Coupe de France" },
  { id: "PT", slug: "por.taca.portugal", name: "Taça de Portugal" },
] as const;

const EVENT_LEAGUES = [...LEAGUES, ...EVENT_ONLY_LEAGUES];

const TTL_MS = 6e5;
const SCORE_TTL_MS = 2e4;
const STALE_MS = 432e5;
const SCHEMA = 40;
const SNAP_FILE = join(process.cwd(), "data", "live-snapshot.json");
const SNAP_FILE_ABS = "/workspace/data/live-snapshot.json";
const SNAP_FILE_TMP = "/tmp/betgpt-data/live-snapshot.json";
const FETCH_MS = 12e3;
let SNAPSHOT = null;
let INFLIGHT = null;
let SCORE_INFLIGHT = null;
const STYLE = {};
for (const t of TEAMS) {
	STYLE[norm(t.name)] = t;
	STYLE[norm(t.short)] = t;
}
function norm(s) {
	return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(fc|cf|afc|sc|ac|rc|ud|cd|ss|calcio)\b/g, "").replace(/[^a-z0-9]+/g, "").trim();
}
function dayKey(iso) {
	return String(iso ?? "").slice(0, 10);
}
function listedOpen(m) {
	if (m.status === "live" || m.status === "finished") return false;
	const t = Date.parse(m.kickoff);
	if (Number.isFinite(t) && Date.now() >= t) return false;
	return true;
}
function sameKick(a, b) {
	return dayKey(a) === dayKey(b);
}
function findSame(list, home, away, kickoff) {
	return list.find((m) => sameFixture(m.home.name, m.away.name, home, away) && sameKick(m.kickoff, kickoff));
}
function preferEspn(list) {
	const espn = [];
	const rest = [];
	for (const m of list) {
		if (String(m.id).startsWith("espn-")) espn.push(m);
		else rest.push(m);
	}
	const out = [...espn];
	for (const m of rest) {
		if (findSame(out, m.home.name, m.away.name, m.kickoff)) continue;
		out.push(m);
	}
	return out;
}
function freezeListed(m, disk) {
	if (!disk?.matches?.length) return null;
	const old = disk.matches.find((d) => d.id === m.id) || findSame(disk.matches, m.home.name, m.away.name, m.kickoff);
	if (!old?.current?.length) return null;
	const ko = Date.parse(m.kickoff);
	if (!Number.isFinite(ko) || !disk.fetchedAt || disk.fetchedAt >= ko - 3e4) return null;
	return { current: old.current, opening: old.opening };
}
function espnN(list) {
	return (list ?? []).filter((m) => String(m.id).startsWith("espn-")).length;
}
function ymd(d) {
	return d.toISOString().slice(0, 10).replaceAll("-", "");
}
function windowRange(daysBack, daysFwd) {
	const now = new Date();
	const from = new Date(now.getTime() - daysBack * 864e5);
	const to = new Date(now.getTime() + daysFwd * 864e5);
	return {
		from: ymd(from),
		to: ymd(to),
		label: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
	};
}
function eachYmd(from, to) {
	const start = new Date(Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8)));
	const end = new Date(Date.UTC(+to.slice(0, 4), +to.slice(4, 6) - 1, +to.slice(6, 8)));
	const days = [];
	for (let t = start.getTime(); t <= end.getTime(); t += 864e5) days.push(ymd(new Date(t)));
	return days.length ? days : [from];
}
async function mapPool(items, limit, fn) {
	const out = new Array(items.length);
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const i = cursor++;
			out[i] = await fn(items[i], i);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
	return out;
}
async function calendarDays(slug) {
	const year = new Date().getUTCFullYear();
	const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${year}/types/1/calendar/ondays?lang=en&region=us`;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_MS),
			headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }
		});
		if (!res.ok) return [];
		const data = await res.json();
		const found = new Set();
		const walk = (node) => {
			if (!node) return;
			if (typeof node === "string") {
				const hit = node.match(/\d{4}-\d{2}-\d{2}/);
				if (hit) found.add(hit[0].replaceAll("-", ""));
				return;
			}
			if (Array.isArray(node)) node.forEach(walk);
			else if (typeof node === "object") Object.values(node).forEach(walk);
		};
		walk(data.eventDate ?? data.sections ?? data);
		return [...found].sort();
	} catch {
		return [];
	}
}
async function fetchBoard(slug, days) {
	const unique = [...new Set(days)].filter(Boolean);
	const boards = await mapPool(unique, 4, (day) => espnJson(`site/v2/sports/soccer/${slug}/scoreboard?dates=${day}&limit=80&lang=en&region=gb`));
	const events = [];
	const seen = new Set();
	for (const board of boards) {
		for (const event of board?.events ?? []) {
			if (!event?.id || seen.has(event.id)) continue;
			seen.add(event.id);
			events.push(event);
		}
	}
	return { events };
}
function hasSoon(snap, now = Date.now()) {
	const max = now + 21 * 864e5;
	return (snap?.matches ?? []).some((m) => {
		const ko = Date.parse(m.kickoff);
		return Number.isFinite(ko) && ko >= now - 6 * 36e5 && ko <= max && m.status !== "cancelled" && m.status !== "finished";
	});
}
async function espnJson(path) {
	const url = `https://site.web.api.espn.com/apis/${path}`;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_MS),
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
				Accept: "application/json",
				Referer: "https://www.espn.co.uk/",
				Origin: "https://www.espn.co.uk"
			}
		});
		if (!res.ok) return {};
		return await res.json();
	} catch {
		return {};
	}
}
function americanToDecimal(raw) {
	if (raw == null) return null;
	const n = typeof raw === "number" ? raw : Number(String(raw).replace("+", ""));
	if (!Number.isFinite(n) || n === 0) return null;
	return clamp(n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n), 1.05, 25);
}
function pickOdds(obj, side) {
	if (!obj) return undefined;
	const bucket = obj[side];
	if (bucket && typeof bucket === "object" && "odds" in bucket) return bucket.odds;
}
function num(v) {
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) && n > 1.01 && n < 40 ? n : null;
}
function parseEspnBook(odds) {
	if (!odds) return null;
	const provider = String(odds.provider?.displayName ?? odds.provider?.name ?? "");
	if (isUsOnlyBook(provider)) return null;
	const homeObj = odds.homeTeamOdds;
	const awayObj = odds.awayTeamOdds;
	const drawObj = odds.drawOdds;
	const home = num(homeObj?.value);
	const away = num(awayObj?.value);
	const draw = num(drawObj?.value);
	const book = /365/.test(provider) ? "Bet365" : provider || "Book";
	if (home && draw && away) return {
		book,
		home,
		draw,
		away,
		openHome: home,
		openDraw: draw,
		openAway: away,
		overLine: null,
		over: null,
		under: null
	};
	const american = moneylineDecimals(odds);
	if (isUsOnlyBook(american.book)) return null;
	if (!american.home || !american.draw || !american.away) return null;
	return {
		book: /365/.test(american.book) ? "Bet365" : american.book,
		home: american.home,
		draw: american.draw,
		away: american.away,
		openHome: american.openHome,
		openDraw: american.openDraw,
		openAway: american.openAway,
		overLine: american.overLine,
		over: american.over,
		under: american.under
	};
}
function moneylineDecimals(odds) {
	const ml = odds?.moneyline ?? {};
	const total = odds?.total ?? {};
	const overClose = total.over?.close;
	const lineRaw = overClose?.line ?? String(odds?.overUnder ?? "");
	const line = Number(String(lineRaw).replace(/[ou]/i, ""));
	return {
		home: americanToDecimal(pickOdds(ml.home, "close")),
		draw: americanToDecimal(pickOdds(ml.draw, "close") ?? (odds?.drawOdds)?.moneyLine),
		away: americanToDecimal(pickOdds(ml.away, "close")),
		openHome: americanToDecimal(pickOdds(ml.home, "open")),
		openDraw: americanToDecimal(pickOdds(ml.draw, "open")),
		openAway: americanToDecimal(pickOdds(ml.away, "open")),
		overLine: Number.isFinite(line) ? line : null,
		over: americanToDecimal(overClose?.odds),
		under: americanToDecimal((total.under?.close)?.odds),
		book: String((odds?.provider)?.displayName ?? (odds?.provider)?.name ?? "")
	};
}
function dp(value, source, confidence, freshnessHours) {
	return {
		value,
		source,
		timestamp: (new Date()).toISOString(),
		confidence,
		freshnessHours
	};
}
function overlayStyle(name, abbr) {
	return STYLE[norm(name)] ?? STYLE[norm(abbr)] ?? {};
}
function standingMap(payload) {
	const out = new Map();
	const entries = payload.children?.[0]?.standings?.entries ?? [];
	for (const e of entries) {
		const id = String(e.team?.id ?? "");
		if (!id) continue;
		const get = (n) => e.stats?.find((s) => s.name === n)?.value ?? 0;
		out.set(id, {
			id,
			gp: get("gamesPlayed") || 1,
			gf: get("pointsFor"),
			ga: get("pointsAgainst"),
			pts: get("points"),
			rank: get("rank") || 10,
			w: get("wins"),
			d: get("ties"),
			l: get("losses")
		});
	}
	return out;
}
function profileFrom(team, league, row, form) {
	const name = team.displayName ?? "Club";
	const short = (team.abbreviation ?? team.shortDisplayName ?? name.slice(0, 3)).slice(0, 4).toUpperCase();
	const style = overlayStyle(name, short);
	const gp = Math.max(row?.gp ?? 1, 1);
	const gpg = (row?.gf ?? 1.3 * gp) / gp;
	const gapg = (row?.ga ?? 1.3 * gp) / gp;
	const rank = row?.rank ?? 10;
	const formWins = (form.match(/W/g) ?? []).length;
	const formLoss = (form.match(/L/g) ?? []).length;
	const attack = clamp((style.attack ?? .9 + gpg * .42) + (formWins - formLoss) * .03, .65, 2.25);
	const defense = clamp((style.defense ?? .7 + gapg * .28) + formLoss * .02, .52, 1.55);
	const elo = style.elo ?? clamp(2080 - (rank - 1) * 16 + (row?.pts ?? 0) * 4, 1600, 2150);
	return {
		id: String(team.id ?? norm(name)),
		name,
		short,
		league,
		attack,
		defense,
		elo,
		xgFor: style.xgFor ?? clamp(gpg * 1.06, .6, 2.6),
		xgAgainst: style.xgAgainst ?? clamp(gapg * .98, .55, 2.2),
		possession: style.possession ?? clamp(62 - rank * .7, 42, 68),
		ppda: style.ppda ?? clamp(8.2 + rank * .18, 7.5, 14),
		fieldTilt: style.fieldTilt ?? clamp(70 - rank * 1.1, 40, 74),
		progressivePasses: style.progressivePasses ?? clamp(58 - rank * 1.1, 28, 64),
		highTurnovers: style.highTurnovers ?? clamp(9.2 - rank * .12, 5, 10.5),
		recoveries: style.recoveries ?? 48,
		compactness: style.compactness ?? clamp(.82 - rank * .012, .45, .9),
		setPieceXg: style.setPieceXg ?? .22,
		duelWin: style.duelWin ?? clamp(56 - rank * .25, 46, 60),
		cardsPerGame: style.cardsPerGame ?? 1.9,
		flexibility: style.flexibility ?? .6,
		pressLine: style.pressLine ?? clamp(.85 - rank * .02, .35, .88),
		buildup: style.buildup ?? clamp(.9 - rank * .02, .35, .92),
		depth: style.depth ?? clamp(.88 - rank * .02, .4, .94),
		formation: style.formation ?? "4-3-3",
		color: team.color ? `#${team.color}` : style.color ?? "#8fad7a",
		logo: logoFor(
			name,
			team.id != null ? String(team.id) : undefined,
			team.logo || (Array.isArray(team.logos) ? team.logos?.[0]?.href : undefined),
		)
	};
}
function booksFromOdds(parsed, _home, _away) {
	const real = parsed.filter((p) => !isUsOnlyBook(p.book) && FR_BOOK_RE.test(p.book));
	const notes = [];
	if (real.length === 0) notes.push("Pas de cote 1X2 listée chez un book FR pour ce match.");
	else notes.push(`1X2 listé chez ${real.map((r) => r.book).join(", ")}.`);
	const current = real.map((p) => ({
		book: p.book,
		home: p.home,
		draw: p.draw,
		away: p.away,
		...EMPTY_TOTALS,
		over15: p.overLine != null && Math.abs(p.overLine - 1.5) < .05 && p.over ? p.over : 0,
		over25: p.overLine != null && Math.abs(p.overLine - 2.5) < .05 && p.over ? p.over : 0,
		over35: p.overLine != null && Math.abs(p.overLine - 3.5) < .05 && p.over ? p.over : 0,
		under25: p.overLine != null && Math.abs(p.overLine - 2.5) < .05 && p.under ? p.under : 0,
		url: undefined,
		homeUrl: undefined,
		drawUrl: undefined,
		awayUrl: undefined
	}));
	const first = current[0];
	return {
		opening: first ? {
			...first,
			book: "Opening",
			home: real[0]?.openHome ?? first.home,
			draw: real[0]?.openDraw ?? first.draw,
			away: real[0]?.openAway ?? first.away
		} : {
			book: "Opening",
			home: 0,
			draw: 0,
			away: 0,
			...EMPTY_TOTALS
		},
		current,
		source: real.map((r) => r.book).join(" / "),
		notes
	};
}
function statusOf(raw, state, completed) {
	const st = (state ?? "").toLowerCase();
	const s = (raw ?? "").toUpperCase();
	if (s.includes("POSTPONED") || s.includes("CANCELED") || s.includes("CANCELLED") || s.includes("ABANDONED") || s.includes("WALKOVER") || s.includes("FORFEIT")) return "cancelled";
	if (st === "in") return "live";
	if (st === "post" || completed) return "finished";
	if (s.includes("IN_PROGRESS") || s.includes("HALFTIME") || s.includes("HALF_TIME") || s.includes("FIRST_HALF") || s.includes("SECOND_HALF") || s.includes("EXTRA_TIME") || s.includes("END_PERIOD") || s.includes("STATUS_HALFTIME")) return "live";
	if (s.includes("FINAL") || s.includes("STATUS_FULL") || s.includes("STATUS_FINAL") || s.includes("FULL_TIME")) return "finished";
	return "scheduled";
}
function voidReasonOf(raw) {
	const s = (raw ?? "").toUpperCase();
	if (s.includes("POSTPONED")) return "postponed";
	if (s.includes("ABANDON")) return "abandoned";
	if (s.includes("CANCEL") || s.includes("WALKOVER") || s.includes("FORFEIT")) return "cancelled";
	return undefined;
}
function clockOf(status) {
	if (!status) return undefined;
	const detail = status.type?.shortDetail || status.type?.detail || status.type?.description || "";
	const clock = (status.displayClock ?? "").trim();
	const d = detail.toLowerCase();
	if (d.includes("half") && (d.includes("end") || d.includes("time") || d.includes("ht"))) return "Mi-temps";
	if (d.includes("half time") || d === "ht") return "Mi-temps";
	if (clock && clock !== "0:00") {
		const m = clock.match(/^(\d+)/);
		if (m) return `${m[1]}'`;
		return clock;
	}
	if (status.period === 1) return "1re";
	if (status.period === 2) return "2e";
	if (detail) return detail;
}
function cupPhaseLabel(slug) {
	const s = (slug ?? "").toLowerCase();
	if (s.includes("round-of-16") || s.includes("eighth") || s.includes("r16")) return "Huitièmes";
	if (s.includes("quarter")) return "Quarts";
	if (s.includes("semi")) return "Demies";
	if (s.includes("final") && !s.includes("semi")) return "Finale";
	if (s.includes("playoff") || s.includes("knockout")) return "Barrages";
	return "Phase de ligue";
}
function parseIncidents(details, homeId, awayId) {
	if (!details?.length) return [];
	const out = [];
	for (const d of details) {
		const raw = (d.type?.text ?? "").toLowerCase();
		const player = d.athletesInvolved?.[0]?.displayName ?? d.athletesInvolved?.[0]?.shortName ?? "";
		const assist = d.athletesInvolved?.[1]?.displayName;
		const minute = d.clock?.displayValue ?? "";
		const side = String(d.team?.id) === awayId ? "away" : "home";
		let kind = "other";
		let label = d.type?.text ?? "Action";
		if (d.ownGoal || raw.includes("own")) {
			kind = "own_goal";
			label = "CSC";
		} else if (d.penaltyKick || raw.includes("penalty")) {
			kind = "penalty";
			label = "But (pén.)";
		} else if (d.scoringPlay || raw.includes("goal")) {
			kind = "goal";
			label = raw.includes("head") ? "But (tête)" : raw.includes("free") ? "But (c.f.)" : "But";
		} else if (d.redCard || raw.includes("red")) {
			kind = "red";
			label = "Rouge";
		} else if (d.yellowCard || raw.includes("yellow")) {
			kind = "yellow";
			label = "Jaune";
		} else if (raw.includes("sub")) {
			kind = "sub";
			label = "Changement";
		} else continue;
		out.push({
			minute,
			kind,
			player: player || "—",
			assist,
			side,
			label
		});
	}
	return out;
}
function parseEvents(payload, league, competition, standings, teams, mode) {
	const matches = [];
	const history = [];
	const events = payload.events ?? [];
	const now = Date.now();
	for (const e of events) {
		const comp = e.competitions?.[0];
		if (!comp) continue;
		const kickoff = comp.date ?? e.date;
		if (!kickoff) continue;
		const homeC = comp.competitors?.find((c) => c.homeAway === "home");
		const awayC = comp.competitors?.find((c) => c.homeAway === "away");
		if (!homeC?.team || !awayC?.team) continue;
		const formH = homeC.form ?? "";
		const formA = awayC.form ?? "";
		const home = profileFrom(homeC.team, league, standings.get(String(homeC.team.id)), formH);
		const away = profileFrom(awayC.team, league, standings.get(String(awayC.team.id)), formA);
		teams[home.id] = home;
		teams[away.id] = away;
		const st = statusOf(comp.status?.type?.name ?? e.status?.type?.name, comp.status?.type?.state ?? e.status?.type?.state, comp.status?.type?.completed);
		const clock = st === "live" ? clockOf(comp.status) : undefined;
		const european = league === "CL" || league === "EL";
		const phase = european ? e.season?.slug ?? "league-phase" : undefined;
		const phaseLabel = european ? cupPhaseLabel(e.season?.slug) : undefined;
		const scoreHome = Number(homeC.score);
		const scoreAway = Number(awayC.score);
		const kickMs = new Date(kickoff).getTime();
		if (mode === "history") {
			if (st !== "finished") continue;
			if (!Number.isFinite(scoreHome) || !Number.isFinite(scoreAway)) continue;
			const books = booksFromOdds((comp.odds ?? []).map((o) => parseEspnBook(o)).filter((x) => Boolean(x)), home, away);
			history.push({
				id: `espn-${e.id}`,
				league,
				kickoff,
				homeId: home.id,
				awayId: away.id,
				goalsHome: scoreHome,
				goalsAway: scoreAway,
				oddsHome: books.opening.home,
				oddsDraw: books.opening.draw,
				oddsAway: books.opening.away,
				closingHome: books.current[0].home,
				closingDraw: books.current[0].draw,
				closingAway: books.current[0].away
			});
			continue;
		}
		if (st === "finished" && now - kickMs > 3456e5 && mode !== "single") continue;
		const parsed = (comp.odds ?? []).map((o) => parseEspnBook(o)).filter((x) => Boolean(x));
		const books = booksFromOdds(parsed, home, away);
		const recH = homeC.records?.[0]?.summary;
		const recA = awayC.records?.[0]?.summary;
		const notes = [
			...books.notes,
			recH || recA ? `Bilan : ${home.short} ${recH ?? "—"} · ${away.short} ${recA ?? "—"}` : "",
			formH || formA ? `Forme récente (ESPN) : ${home.short} ${formH || "—"} · ${away.short} ${formA || "—"}` : ""
		].filter(Boolean);
		if (st === "live") notes.unshift("Match en cours.");
		if (st === "finished") notes.unshift(`Terminé ${scoreHome}–${scoreAway}.`);
		if (st === "cancelled") notes.unshift("Match reporté ou annulé — pronos void.");
		const voidReason = st === "cancelled" ? voidReasonOf(comp.status?.type?.name ?? e.status?.type?.name) ?? "cancelled" : undefined;
		matches.push({
			id: `espn-${e.id}`,
			league,
			competition,
			kickoff,
			venue: comp.venue?.fullName ?? e.venue?.fullName ?? "Stade",
			home,
			away,
			restHome: dp(6, "non observé sur le calendrier live", .35, 24),
			restAway: dp(6, "non observé sur le calendrier live", .35, 24),
			travelAwayKm: dp(250, "estimation", .3, 48),
			congestionHome: dp(.25, "non observé", .3, 24),
			congestionAway: dp(.25, "non observé", .3, 24),
			absencesHome: dp([], "feuille d'effectif non branchée", .25, 24),
			absencesAway: dp([], "feuille d'effectif non branchée", .25, 24),
			importance: dp(european ? clamp(rankImportance(standings.get(home.id)?.rank, standings.get(away.id)?.rank) + .12, .55, .98) : rankImportance(standings.get(home.id)?.rank, standings.get(away.id)?.rank), european ? competition : "classement live", .7, 12),
			opening: books.opening,
			current: books.current,
			notes,
			status: st,
			voidReason,
			scoreHome: st === "cancelled" ? undefined : Number.isFinite(scoreHome) ? scoreHome : undefined,
			scoreAway: st === "cancelled" ? undefined : Number.isFinite(scoreAway) ? scoreAway : undefined,
			clock,
			incidents: parseIncidents(comp.details, home.id, away.id),
			slug: matchSlug({
				home,
				away,
				kickoff,
				id: `espn-${e.id}`
			}),
			phase,
			phaseLabel,
			formHome: formH,
			formAway: formA,
			oddsSource: books.source,
			listedTotal: parsed[0]?.overLine ?? undefined
		});
	}
	return {
		matches,
		history
	};
}
function rankImportance(rh, ra) {
	const a = rh ?? 10;
	const b = ra ?? 10;
	return clamp(.45 + (21 - Math.min(a, b)) * .02 + (Math.abs(a - b) < 4 ? .12 : 0), .35, .98);
}
async function fetchLeague(league) {
	try {
		const days = await calendarDays(league.slug);
		const now = new Date();
		const min = ymd(new Date(now.getTime() - 2 * 864e5));
		const max = ymd(new Date(now.getTime() + 24 * 864e5));
		const pastMin = ymd(new Date(now.getTime() - 16 * 864e5));
		let upcomingDays = days.filter((d) => d >= min && d <= max);
		let historyDays = days.filter((d) => d >= pastMin && d < min).slice(-6);
		if (!upcomingDays.length) upcomingDays = eachYmd(min, ymd(new Date(now.getTime() + 3 * 864e5)));
		const [board, past, table] = await Promise.all([
			fetchBoard(league.slug, upcomingDays),
			fetchBoard(league.slug, historyDays),
			espnJson(`v2/sports/soccer/${league.slug}/standings?lang=en&region=us`)
		]);
		const standings = standingMap(table);
		const teams = {};
		const up = parseEvents(board, league.id, league.name, standings, teams, "upcoming");
		const hi = parseEvents(past, league.id, league.name, standings, teams, "history");
		return {
			matches: up.matches,
			history: hi.history,
			teams
		};
	} catch {
		return {
			matches: [],
			history: [],
			teams: {}
		};
	}
}
function matchFromUnibet(f, teams) {
	const leagueName = f.competition || LEAGUES.find((l) => l.id === f.league)?.name || f.league;
	const home = profileFrom({
		displayName: f.home,
		abbreviation: f.home.slice(0, 3)
	}, f.league, undefined, "");
	const away = profileFrom({
		displayName: f.away,
		abbreviation: f.away.slice(0, 3)
	}, f.league, undefined, "");
	teams[home.id] = home;
	teams[away.id] = away;
	const kickoff = f.start.endsWith("Z") ? f.start : `${f.start}Z`;
	const id = `ub-${f.key}-${kickoff.slice(0, 10)}`;
	const european = f.league === "CL" || f.league === "EL";
	const opening = {
		...f.book,
		book: "Opening"
	};
	return {
		id,
		league: f.league,
		competition: leagueName,
		kickoff,
		venue: "Stade",
		home,
		away,
		restHome: dp(6, "non observé sur le calendrier live", .35, 24),
		restAway: dp(6, "non observé sur le calendrier live", .35, 24),
		travelAwayKm: dp(250, "estimation", .3, 48),
		congestionHome: dp(.25, "non observé", .3, 24),
		congestionAway: dp(.25, "non observé", .3, 24),
		absencesHome: dp([], "feuille d'effectif non branchée", .25, 24),
		absencesAway: dp([], "feuille d'effectif non branchée", .25, 24),
		importance: dp(european ? .82 : .62, leagueName, .55, 12),
		opening,
		current: [{
			...f.book,
			book: "Unibet"
		}],
		notes: [`Cotes 1X2 listées chez Unibet.`],
		status: "scheduled",
		slug: matchSlug({
			home,
			away,
			kickoff,
			id
		}),
		phase: european ? "league-phase" : undefined,
		phaseLabel: european ? "Phase de ligue" : undefined,
		oddsSource: "Unibet"
	};
}
async function loadSnapshot() {
	const up = windowRange(2, 24);
	const [parts, unibet, pages] = await Promise.all([
		Promise.all(LEAGUES.map((l) => fetchLeague(l))),
		fetchUnibetBooks().catch(() => ({
			books: new Map(),
			fixtures: []
		})),
		fetchBookPages().catch(() => new Map())
	]);
	const teams = {};
	const matches = [];
	const hist = [];
	for (const p of parts) {
		Object.assign(teams, p.teams);
		matches.push(...p.matches);
		hist.push(...p.history);
	}
	if (!matches.some((m) => m.status === "live")) {
		const today = ymd(new Date());
		for (const league of LEAGUES) {
			const board = await fetchBoard(league.slug, eachYmd(today, today));
			const parsed = parseEvents(board, league.id, league.name, new Map(), teams, "upcoming");
			for (const m of parsed.matches) {
				const i = matches.findIndex((x) => x.id === m.id || (findSame([x], m.home.name, m.away.name, m.kickoff) && true));
				if (i >= 0) {
					const cur = matches[i];
					cur.status = m.status;
					cur.scoreHome = m.scoreHome;
					cur.scoreAway = m.scoreAway;
					cur.clock = m.clock;
					cur.home = m.home;
					cur.away = m.away;
					if (String(m.id).startsWith("espn-")) cur.id = m.id;
				} else matches.push(m);
			}
		}
	}
	const uniBooks = unibet.books;
	const diskKeep = readDiskSnap();
	for (const f of unibet.fixtures) {
		if (!f.start || findSame(matches, f.home, f.away, f.start)) continue;
		if (!listedOpen({ kickoff: f.start, status: "scheduled" })) continue;
		matches.push(matchFromUnibet(f, teams));
	}
	for (const m of matches) {
		const open = listedOpen(m);
		const extra = lookupUniBook(uniBooks, m.home.name, m.away.name);
		if (extra && open) {
			const merged = {
				...extra,
				over15: extra.over15 || 0,
				over25: extra.over25 || 0,
				over35: extra.over35 || 0,
				under25: extra.under25 || 0,
				bttsYes: extra.bttsYes || 0,
				bttsNo: extra.bttsNo || 0,
				cs11: extra.cs11,
				cs: extra.cs
			};
			const i = m.current.findIndex((b) => /unibet/i.test(b.book));
			if (i >= 0) m.current[i] = {
				...m.current[i],
				...merged,
				book: "Unibet"
			};
			else m.current.push({
				...merged,
				book: "Unibet"
			});
			if (extra.cs11) m.cs11Odds = extra.cs11;
			if (extra.cs) m.cs11Odds = extra.cs["1-1"] ?? m.cs11Odds;
		}
		// Book pages are URL discovery only. Never infer 1X2 prices from arbitrary
		// HTML numbers: quotes must come from a provider payload with observedAt.
		const frBooks = lookupBookPages(pages, m.home.name, m.away.name);
		for (const p of frBooks) {
			const i = m.current.findIndex((b) => b.book.toLowerCase() === p.book.toLowerCase());
			if (i < 0) continue;
			const cur = m.current[i];
			cur.url = p.url;
			cur.homeUrl = p.url;
			cur.drawUrl = p.url;
			cur.awayUrl = p.url;
		}
		if (!open) {
			const frozen = freezeListed(m, diskKeep);
			if (frozen?.current?.length) {
				m.current = frozen.current;
				if (frozen.opening) m.opening = frozen.opening;
			} else m.current = [];
		}
		m.current = m.current.filter((b) => {
			if (!FR_BOOK_RE.test(b.book) || isUsOnlyBook(b.book)) return false;
			if (!(b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05)) return false;
			if (!open) return true;
			const observed = Date.parse(String(b.observedAt ?? ""));
			return Number.isFinite(observed) && Date.now() - observed >= -60_000 && Date.now() - observed <= 5 * 60_000;
		});
		const names = [...new Set(m.current.map((b) => b.book))];
		m.oddsSource = names.join(" / ");
		m.listedTotal = m.current.some((b) => b.over25 >= 1.05) ? 2.5 : undefined;
		m.notes = m.notes.filter((n) => !/DraftKings|estimé par le modèle|dérivés/i.test(n));
		if (names.length) {
			m.notes = m.notes.filter((n) => !n.startsWith("1X2") && !n.startsWith("Pas de cote"));
			m.notes.push(`Cotes 1X2 listées chez ${names.join(" et ")}.`);
		} else m.notes.push(open ? "Pas de cote 1X2 listée chez un book FR." : "Match en cours : cotes 1X2 live non utilisées.");
		applyAffiliateUrls(m, pages);
	}
	const kept = preferEspn(matches);
	matches.splice(0, matches.length, ...kept);
	if (diskKeep?.matches?.length) {
		for (const d of diskKeep.matches) {
			if (findSame(matches, d.home.name, d.away.name, d.kickoff)) continue;
			if (d.status === "finished") continue;
			if (!listedOpen(d)) continue;
			matches.push(d);
		}
	}
	matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
	hist.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
	try {
		await hydrateMatchForm(matches, { limit: 36 });
	} catch {
		/* form optional */
	}
	const disk = diskKeep;
	if (disk && disk.schema === SCHEMA && espnN(disk.matches) > espnN(matches) && disk.matches.length > matches.length) return {
		...disk,
		meta: {
			...disk.meta,
			stale: true
		}
	};
	const fetchedAt = Date.now();
	const booksUsed = [...new Set(matches.flatMap((m) => (m.current ?? []).map((b) => b.book)))].filter((b) => b !== "Modèle" && b !== "Opening");
	return {
		schema: SCHEMA,
		fetchedAt,
		matches,
		history: hist,
		teams,
		meta: {
			asOf: new Date(fetchedAt).toISOString(),
			window: up.label,
			source: `Calendrier officiel · cotes ${booksUsed.join(" / ") || "UE"}`,
			stale: false,
			nMatches: matches.length,
			nHistory: hist.length
		}
	};
}
function readDiskSnap() {
	for (const file of [SNAP_FILE, SNAP_FILE_ABS, SNAP_FILE_TMP]) try {
		const raw = JSON.parse(readFileSync(file, "utf8"));
		if (raw && Array.isArray(raw.matches) && raw.matches.length) return raw;
	} catch {}
	return null;
}
function writeDiskSnap(s) {
	if (!s.matches.length) return;
	const disk = readDiskSnap();
	if (disk && disk.schema === SCHEMA && espnN(disk.matches) > espnN(s.matches) && disk.matches.length > s.matches.length) return;
	try {
		const prev = Array.isArray(disk?.matches) ? disk.matches : [];
		recordScoreDiff(prev, s.matches);
	} catch {
		/* ledger optional */
	}
	try {
		mkdirSync(dirname(SNAP_FILE), { recursive: true });
		writeFileSync(SNAP_FILE, JSON.stringify(s));
	} catch {
		try {
			mkdirSync(dirname(SNAP_FILE_TMP), { recursive: true });
			writeFileSync(SNAP_FILE_TMP, JSON.stringify(s));
		} catch {}
	}
	pingIndexNow(s);
}
function pingIndexNow(s) {
	const live = s.matches.filter((m) => m.status === "live").map((m) => `https://betgpt.live/match/${m.slug ?? m.id}`);
	const urls = [
		"https://betgpt.live/",
		"https://betgpt.live/actu",
		"https://betgpt.live/actu/" + (new Date()).toISOString().slice(0, 10),
		"https://betgpt.live/news-sitemap.xml",
		...live,
		...s.matches.slice(0, 24).map((m) => `https://betgpt.live/match/${m.slug ?? m.id}`)
	];
	const unique = [...new Set(urls)];
	const body = JSON.stringify({
		host: "betgpt.live",
		key: "betgpt-live-indexnow",
		keyLocation: "https://betgpt.live/betgpt-live-indexnow.txt",
		urlList: unique
	});
	fetch("https://api.indexnow.org/indexnow", {
		method: "POST",
		headers: { "content-type": "application/json; charset=utf-8" },
		body,
		signal: AbortSignal.timeout(4e3)
	}).catch(() => undefined);
	const ping = (map) => fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(map)}`, { signal: AbortSignal.timeout(4e3) }).catch(() => undefined);
	ping("https://betgpt.live/sitemap.xml");
	ping("https://betgpt.live/news-sitemap.xml");
}
function cacheTtl(snap) {
	if (snap?.matches.some((m) => m.status === "live")) return SCORE_TTL_MS;
	return TTL_MS;
}
function refreshScoresInFlight() {
	if (SCORE_INFLIGHT) return SCORE_INFLIGHT;
	SCORE_INFLIGHT = refreshScores().then((s) => {
		SNAPSHOT = s;
		return s;
	}).catch(() => SNAPSHOT ?? refreshInFlight()).finally(() => {
		SCORE_INFLIGHT = null;
	});
	return SCORE_INFLIGHT;
}
async function refreshScores() {
	if (!SNAPSHOT?.matches.length) return loadSnapshot();
	const matches = SNAPSHOT.matches.map((m) => ({
		...m,
		incidents: m.incidents ? [...m.incidents] : []
	}));
	const up = windowRange(.2, 1.5);
	const dates = eachYmd(up.from, up.to);
	const boards = await Promise.all(LEAGUES.map((l) => fetchBoard(l.slug, dates)));
	const byId = new Map(matches.map((m) => [m.id, m]));
	for (let i = 0; i < LEAGUES.length; i++) {
		const events = boards[i]?.events ?? [];
		for (const e of events) {
			const comp = e.competitions?.[0];
			if (!comp) continue;
			const homeC = comp.competitors?.find((c) => c.homeAway === "home");
			const awayC = comp.competitors?.find((c) => c.homeAway === "away");
			let cur = byId.get(`espn-${e.id}`);
			if (!cur) cur = findSame(matches, homeC?.team?.displayName ?? "", awayC?.team?.displayName ?? "", e.date ?? comp.date);
			if (!cur) continue;
			const st = statusOf(comp.status?.type?.name ?? e.status?.type?.name, comp.status?.type?.state ?? e.status?.type?.state, comp.status?.type?.completed);
			const scoreHome = Number(homeC?.score);
			const scoreAway = Number(awayC?.score);
			cur.status = st;
			if (st === "cancelled") {
				cur.voidReason = voidReasonOf(comp.status?.type?.name ?? e.status?.type?.name) ?? "cancelled";
				cur.scoreHome = undefined;
				cur.scoreAway = undefined;
			} else {
				cur.scoreHome = Number.isFinite(scoreHome) ? scoreHome : cur.scoreHome;
				cur.scoreAway = Number.isFinite(scoreAway) ? scoreAway : cur.scoreAway;
			}
			cur.clock = st === "live" ? clockOf(comp.status) : undefined;
			cur.incidents = parseIncidents(comp.details, cur.home.id, cur.away.id);
			if (homeC?.team?.id) {
				cur.home.id = String(homeC.team.id);
				cur.home.logo = logoFor(cur.home.name, cur.home.id, homeC.team.logo || homeC.team.logos?.[0]?.href);
			}
			if (awayC?.team?.id) {
				cur.away.id = String(awayC.team.id);
				cur.away.logo = logoFor(cur.away.name, cur.away.id, awayC.team.logo || awayC.team.logos?.[0]?.href);
			}
			if (st === "live" || st === "finished" || st === "cancelled") {
				const frozen = freezeListed({ ...cur, status: st }, SNAPSHOT);
				if (frozen?.current?.length) cur.current = frozen.current;
				else cur.current = [];
			}
		}
	}
	const fetchedAt = Date.now();
	return {
		...SNAPSHOT,
		matches,
		fetchedAt,
		meta: {
			...SNAPSHOT.meta,
			asOf: new Date(fetchedAt).toISOString(),
			stale: false,
			nMatches: SNAPSHOT.matches.length
		}
	};
}
function refreshInFlight() {
	if (INFLIGHT) return INFLIGHT;
	INFLIGHT = loadSnapshot().then((s) => {
		SNAPSHOT = s;
		writeDiskSnap(s);
		return s;
	}).catch(() => {
		if (SNAPSHOT && Date.now() - SNAPSHOT.fetchedAt < STALE_MS) {
			SNAPSHOT = {
				...SNAPSHOT,
				meta: {
					...SNAPSHOT.meta,
					stale: true
				}
			};
			return SNAPSHOT;
		}
		const disk = readDiskSnap();
		if (disk) {
			SNAPSHOT = {
				...disk,
				meta: {
					...disk.meta,
					stale: true
				}
			};
			return SNAPSHOT;
		}
		throw new Error("Calendrier indisponible.");
	}).finally(() => {
		INFLIGHT = null;
	});
	return INFLIGHT;
}
export function hydrateLiveFromDisk() {
	const disk = readDiskSnap();
	if (disk && disk.schema !== SCHEMA) return SNAPSHOT;
	const have = SNAPSHOT?.matches.length ?? 0;
	const diskN = disk?.matches.length ?? 0;
	if (disk && diskN > have && espnN(disk.matches) >= espnN(SNAPSHOT?.matches)) SNAPSHOT = disk;
	return SNAPSHOT;
}
export async function ensureLive() {
  if (process.env.BETGPT_OFFLINE === "1") return hydrateLiveFromDisk();
	const now = Date.now();
	if (!SNAPSHOT) SNAPSHOT = readDiskSnap();
	if (SNAPSHOT && SNAPSHOT.schema !== SCHEMA) SNAPSHOT = null;
	const young = SNAPSHOT && now - SNAPSHOT.fetchedAt < cacheTtl(SNAPSHOT);
	const broad = (SNAPSHOT?.matches ?? []).some((m) => m.league === "L1" || m.league === "PL" || m.league === "LL" || m.league === "BL" || m.league === "SA");
	if (young && hasSoon(SNAPSHOT, now) && broad) return SNAPSHOT;
	try {
		return await refreshInFlight();
	} catch {
		return SNAPSHOT;
	}
}
export function getLiveSnapshot() {
	return SNAPSHOT;
}
export function getUpcomingMatches() {
	return SNAPSHOT?.matches ?? [];
}
export function generateHistory() {
	return SNAPSHOT?.history ?? [];
}
export function lookupTeam(id: string) {
	return SNAPSHOT?.teams[id];
}
export function bustLive() {
	SNAPSHOT = null;
	INFLIGHT = null;
	SCORE_INFLIGHT = null;
}

export type ResultRecoveryTarget = {
  matchId: string;
  kickoff: string;
  league?: LeagueId;
};

export function resultRecoveryLeagueSlugs(league?: LeagueId): string[] {
  const specs = league ? EVENT_LEAGUES.filter((row) => row.id === league) : EVENT_LEAGUES;
  return [...new Set(specs.map((row) => row.slug))];
}

/**
 * Recover final ESPN scores for already-published tickets after they have left
 * the main live window. Requests are batched by fixture date + internal league
 * family, so an international ticket can still settle even when its exact
 * competition lives in EVENT_ONLY_LEAGUES.
 */
export async function recoverEspnResults(targets: ResultRecoveryTarget[]): Promise<MatchInput[]> {
  const now = Date.now();
  const unique = new Map<string, ResultRecoveryTarget>();
  for (const target of targets) {
    if (!/^espn-\d{5,12}$/i.test(target.matchId)) continue;
    const kickoffMs = Date.parse(target.kickoff);
    if (!Number.isFinite(kickoffMs) || kickoffMs > now - 90 * 60_000 || now - kickoffMs > 8 * 864e5) continue;
    unique.set(target.matchId, target);
  }

  // Resolve only a bounded batch per checkpoint call. Direct event summaries are
  // much cheaper than scanning every competition scoreboard for the fixture date.
  const batch = [...unique.values()]
    .sort((a, b) => String(b.kickoff).localeCompare(String(a.kickoff)))
    .slice(0, 4);

  const hits = await mapPool(batch, 2, async (target) => {
    const match = await fetchEspnEvent(target.matchId, target.league);
    if (!match || (match.status !== "finished" && match.status !== "cancelled")) return null;
    return match;
  });

  return hits.filter((match): match is MatchInput => Boolean(match));
}

/** Fetch a single ESPN soccer event even after it left the live window. */
export async function fetchEspnEvent(id, leagueHint?: LeagueId) {
	const rawId = String(id ?? "");
	const eid = rawId.replace(/^espn-/i, "");
	if (!/^\d{5,12}$/.test(eid)) {
		// Public URLs use human slugs. If the match is outside the in-memory desk,
		// resolve it directly from the dated ESPN scoreboards instead of returning
		// a dead dossier page.
		const dm = rawId.match(/(\d{4}-\d{2}-\d{2})$/);
		if (!dm) return null;
		const date = dm[1].replaceAll("-", "");
		const hits = await Promise.all(
			EVENT_LEAGUES.map(async (l) => {
				try {
					const board = await fetchBoard(l.slug, [date]);
					const parsed = parseEvents(board, l.id, l.name, new Map(), {}, "single");
					return parsed.matches.find((m) => m.slug === rawId) ?? null;
				} catch {
					return null;
				}
			}),
		);
		return hits.find(Boolean) ?? null;
	}
	const headers = {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
		Accept: "application/json",
		Referer: "https://www.espn.co.uk/",
		Origin: "https://www.espn.co.uk"
	};
	const candidateLeagues = leagueHint ? EVENT_LEAGUES.filter((l) => l.id === leagueHint) : EVENT_LEAGUES;
	const hits = await Promise.all(candidateLeagues.map(async (l) => {
		try {
			const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/${l.slug}/summary?event=${eid}`, {
				signal: AbortSignal.timeout(4000),
				headers
			});
			if (!res.ok) return null;
			const json = await res.json();
			if (json?.header?.competitions || json?.header?.id) return { l, json };
		} catch {
			return null;
		}
		return null;
	}));
	const hit = hits.find(Boolean);
	if (!hit) return null;
	const header = { ...hit.json.header };
	const venue = hit.json.gameInfo?.venue;
	if (venue && header.competitions?.[0] && !header.competitions[0].venue) {
		header.competitions = [{ ...header.competitions[0], venue }];
	}
	const parsed = parseEvents({ events: [header] }, hit.l.id, hit.l.name, new Map(), {}, "single");
	return parsed.matches[0] ?? null;
}
