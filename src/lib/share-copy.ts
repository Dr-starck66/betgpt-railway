import { fmtOdds } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";
import { LEAGUE_LABEL } from "@/lib/labels";
import type { LeagueId } from "@/engine/types";

export type ShareTicket = {
  home: string;
  away: string;
  label: string;
  odds: number;
  league: LeagueId;
};

export type SharePost = {
  id: string;
  title: string;
  text: string;
};

const URL = `${SITE_URL}/opportunities`;
const FOOT = "18+ · Jouer comporte des risques.";

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

function bullets(tickets: ShareTicket[], style: 0 | 1 | 2): string {
  return tickets
    .slice(0, 5)
    .map((t) => {
      if (style === 1) return `${t.home} / ${t.away} → ${t.label} (${fmtOdds(t.odds)})`;
      if (style === 2) return `${fmtOdds(t.odds)} · ${t.label} · ${t.home}–${t.away}`;
      return `• ${t.home} – ${t.away} · ${t.label} · ${fmtOdds(t.odds)}`;
    })
    .join("\n");
}

export function buildSharePosts(tickets: ShareTicket[], salt = 1): SharePost[] {
  const base = tickets.slice(0, 5);
  if (!base.length) {
    return [
      {
        id: "empty",
        title: "Veille",
        text: `Rien à forcer ce soir.\n\nFeuille : ${URL}\n${FOOT}`,
      },
    ];
  }
  const n = base.length;
  const a = base[0]!;
  const cup = base.some((t) => t.league === "CL" || t.league === "EL");
  const orderA = base;
  const orderB = shuffle(base, salt + 11);
  const orderC = shuffle(base, salt + 29);
  const orderD = shuffle(base, salt + 47);
  const orderE = shuffle(base, salt + 67);
  const orderF = shuffle(base, salt + 97);

  return [
    {
      id: "vestiaire",
      title: "Vestiaire",
      text: `Petite feuille ${cup ? "coupe" : "du soir"}, sans combiné de 12.\n\n${n} tickets :\n${bullets(orderA, 0)}\n\nLe détail (cotes FR) : ${URL}\n${FOOT}`,
    },
    {
      id: "question",
      title: "Question",
      text: `${a.home} – ${a.away} ce soir, vous touchez ou vous passez ?\n\nJ’ai ${n} mises, pas un roman :\n${bullets(orderB, 1)}\n\n${URL}\n${FOOT}`,
    },
    {
      id: "sec",
      title: "Sec",
      text: `Pronos · ${LEAGUE_LABEL[a.league]}\n${bullets(orderC, 2)}\n\nPas de lock. Cote + filet.\n${URL}\n${FOOT}`,
    },
    {
      id: "cafe",
      title: "Café",
      text: `Au café on m’a demandé ce que je jouais.\nRéponse courte :\n${bullets(orderD, 0)}\n\nSi tu veux la feuille : ${URL}\n${FOOT}`,
    },
    {
      id: "pas-combo",
      title: "Pas de combo",
      text: `Je ne stacke pas 8 matchs. ${n} ticket${n > 1 ? "s" : ""}, un par un.\n${bullets(orderE, 1)}\n\n${URL}\n${FOOT}`,
    },
    {
      id: "cote",
      title: "Cote",
      text: `Ce qui m’a accroché ce soir, c’est surtout ${a.label.toLowerCase()} sur ${a.home}–${a.away} à ${fmtOdds(a.odds)}.\n\nLe reste du ticket :\n${bullets(orderF, 0)}\n\n${URL}\n${FOOT}`,
    },
  ];
}
