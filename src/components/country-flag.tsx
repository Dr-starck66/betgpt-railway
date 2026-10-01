import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

function flagEmoji(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return [...normalized].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}

function twemojiFlagUrl(code: string): string | null {
  const emoji = flagEmoji(code);
  if (!emoji) return null;
  const codepoints = [...emoji].map((char) => char.codePointAt(0)!.toString(16)).join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${codepoints}.svg`;
}

export function CountryFlag({
  code,
  label,
  size = 20,
  className,
}: {
  code?: string | null;
  label: string;
  size?: number;
  className?: string;
}) {
  const normalized = (code ?? "").trim().toUpperCase();
  const sources = useMemo(() => {
    if (!/^[A-Z]{2}$/.test(normalized)) return [] as string[];
    const primary = `https://flagcdn.com/${normalized.toLowerCase()}.svg`;
    const secondary = twemojiFlagUrl(normalized);
    return secondary ? [primary, secondary] : [primary];
  }, [normalized]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex];

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm border border-line bg-raised px-1 font-semibold text-paper",
          className,
        )}
        style={{ minWidth: size * 1.45, height: size, fontSize: Math.max(8, size * 0.46) }}
        title={label}
        aria-label={`Pays : ${label}`}
      >
        {normalized || "??"}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`Drapeau ${label}`}
      title={label}
      width={Math.round(size * 1.45)}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("inline-block shrink-0 rounded-[2px] bg-white object-cover ring-1 ring-line", className)}
      style={{ width: Math.round(size * 1.45), height: size }}
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
