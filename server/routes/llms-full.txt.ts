import { defineEventHandler, setHeader } from "h3";
import { ensureLive } from "../../src/engine/live";
import { featuredAnswer, SITE_URL } from "../../src/lib/seo";

export default defineEventHandler(async (event) => {
  let matches: Awaited<ReturnType<typeof ensureLive>>["matches"] = [];
  try {
    matches = (await ensureLive()).matches;
  } catch {
    matches = [];
  }
  const lines = [
    "# BetGpt",
    `> Faits football citables. Source : ${SITE_URL}`,
    "",
    `Mis à jour : ${new Date().toISOString()}`,
    "",
  ];
  for (const m of matches) {
    lines.push(`## ${m.home.name} – ${m.away.name}`);
    lines.push(`URL: ${SITE_URL}/match/${m.slug ?? m.id}`);
    lines.push(featuredAnswer(m));
    lines.push("");
  }
  setHeader(event, "content-type", "text/plain; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=120");
  return lines.join("\n");
});
