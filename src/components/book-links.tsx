import { trackedUrl } from "@/lib/track";
import { FR_BOOK_RE } from "@/engine/affiliates";
import { cn, fmtOdds } from "@/lib/utils";

export function PrimaryParier({
  links,
  matchId,
  book,
  odds,
  pick,
  label,
}: {
  links: { book: string; url: string }[];
  matchId?: string;
  book?: string;
  odds?: number;
  pick?: string;
  label?: string;
}) {
  const ok = links.filter((l) => FR_BOOK_RE.test(l.book) && l.url);
  if (!ok.length) return null;
  const want = (book ?? "").toLowerCase();
  const hit =
    ok.find((l) => want && l.book.toLowerCase().includes(want.replace(/\s·\s.*$/, "").trim())) ?? ok[0]!;
  const oddsTxt = odds && odds > 1 ? ` ${fmtOdds(odds)}` : "";
  const text =
    label ??
    (pick
      ? `Voir la cote ${pick}${oddsTxt} chez ${hit.book} →`
      : `Voir la meilleure cote${oddsTxt} chez ${hit.book} →`);
  return (
    <a
      href={trackedUrl(hit.book, hit.url, matchId)}
      rel="noopener noreferrer"
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      title={`Ouvrir ${hit.book} · 18+`}
      aria-label={`Voir les cotes chez ${hit.book}`}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-xl border border-sage/70 bg-sage px-5 font-black text-ink shadow-[0_10px_24px_rgba(124,194,58,0.22)] transition hover:-translate-y-0.5 hover:brightness-95",
        label ? "text-sm uppercase tracking-wide" : "text-sm sm:text-base",
      )}
    >
      {text}
    </a>
  );
}

export function BookLinks({
  links,
  compact,
  matchId,
}: {
  links: { book: string; url: string }[];
  compact?: boolean;
  matchId?: string;
}) {
  if (!links.length) return null;
  const ok = links.filter((l) => FR_BOOK_RE.test(l.book) && l.url);
  if (!ok.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ok.map((l) => (
        <a
          key={l.book}
          href={trackedUrl(l.book, l.url, matchId)}
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-sage/60 font-black transition hover:-translate-y-0.5 hover:brightness-95",
            compact
              ? "min-h-10 bg-sage/15 px-3 text-xs text-paper hover:bg-sage hover:text-ink"
              : "min-h-12 bg-sage px-4 text-sm text-ink shadow-[0_8px_18px_rgba(124,194,58,0.18)]",
          )}
          target="_blank"
          title={`Ouvrir ${l.book} · 18+`}
          aria-label={`Voir les cotes chez ${l.book}`}
        >
          Voir les cotes chez {l.book} →
        </a>
      ))}
    </div>
  );
}
