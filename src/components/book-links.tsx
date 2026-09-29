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
  const text = label ?? (pick ? `Parier ${pick}${oddsTxt}` : `Parier${oddsTxt}`);
  return (
    <a
      href={trackedUrl(hit.book, hit.url, matchId)}
      rel="noopener noreferrer sponsored"
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      title="Lien sponsorisé · 18+"
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-md bg-sage px-5 font-semibold text-ink hover:opacity-90",
        label ? "text-sm uppercase tracking-wide" : "text-base",
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
          rel="noopener noreferrer sponsored"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center rounded-md border border-line bg-surface font-semibold text-paper hover:border-sage hover:bg-sage hover:text-ink",
            compact ? "min-h-9 px-2.5 text-xs" : "min-h-11 px-3 text-sm",
          )}
          target="_blank"
        >
          Parier · {l.book}
        </a>
      ))}
    </div>
  );
}
