import { loadAdmin } from "./admin";
import { AFF_BOOKS, specOf } from "./aff-tag";

export type AffiliateActivationSource = "env" | "admin" | "none";
export type AffiliateConversionMode = "MONETIZED" | "TRACKING_READY" | "UNSUPPORTED";

export type AffiliateBookReadiness = {
  key: string;
  label: string;
  mode: AffiliateConversionMode;
  configured: boolean;
  source: AffiliateActivationSource;
  tracking: true;
};

function tagSource(key: string): AffiliateActivationSource {
  const env = process.env[`AFF_${key.toUpperCase()}`]?.trim();
  if (env) return "env";
  const admin = loadAdmin().affTags?.[key]?.trim();
  if (admin) return "admin";
  return "none";
}

export function affiliateBookReadiness(book: string): AffiliateBookReadiness {
  const spec = specOf(book);
  if (!spec) {
    return {
      key: "unsupported",
      label: String(book || "bookmaker"),
      mode: "UNSUPPORTED",
      configured: false,
      source: "none",
      tracking: true,
    };
  }

  const source = tagSource(spec.key);
  const configured = source !== "none";
  return {
    key: spec.key,
    label: spec.label,
    mode: configured ? "MONETIZED" : "TRACKING_READY",
    configured,
    source,
    tracking: true,
  };
}

export function affiliateConversionSnapshot() {
  const books = AFF_BOOKS.map((book) => affiliateBookReadiness(book.label));
  const monetized = books.filter((book) => book.configured);
  return {
    schema: "astra-affiliate-conversion/v1",
    status: monetized.length ? "MONETIZED" : "TRACKING_READY",
    trackingReady: true,
    monetizedCount: monetized.length,
    totalBooks: books.length,
    books,
  } as const;
}
