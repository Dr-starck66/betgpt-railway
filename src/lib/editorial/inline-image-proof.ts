import type { EditorialArticle } from "./types.ts";

/**
 * Additional fail-closed proof for NEW native editorial candidates.
 * Historical articles are untouched; cover never counts as an inline image.
 * This checks declared provenance and structure, NOT actual licensing or bytes.
 * Publication still requires independently verified source and file metadata.
 */
export function inlineImageProof(article: Pick<EditorialArticle, "paragraphs" | "image">): { pass: boolean; reasons: string[]; count: number } {
  const images = article.paragraphs.flatMap((section, index) => section.inlineImage ? [{ image: section.inlineImage, index }] : []);
  const reasons: string[] = [];
  if (images.length < 2) reasons.push("images en corps : deux photographies dans deux sections H2 distinctes obligatoires");
  const seen = new Set<string>([article.image.src]);
  for (const { image, index } of images) {
    if (!image.src || seen.has(image.src)) reasons.push("images en corps : couverture ou photographie dupliquée (section " + (index + 1) + ")");
    seen.add(image.src);
    if (image.width < 1200 || image.height < 675 || image.width / image.height < 1.45 || image.width / image.height > 2.05) {
      reasons.push("images en corps : dimensions/paysage insuffisants (section " + (index + 1) + ")");
    }
    if (!image.alt?.trim() || !image.caption?.trim() || !image.credit?.trim()) {
      reasons.push("images en corps : alt, légende ou crédit manquant (section " + (index + 1) + ")");
    }
    for (const [label, value] of [["source", image.sourceUrl], ["licence", image.licenseUrl]] as const) {
      try { if (!value || new URL(value).protocol !== "https:") throw new Error("missing"); }
      catch { reasons.push("images en corps : " + label + " HTTPS vérifiable manquant (section " + (index + 1) + ")"); }
    }
  }
  return { pass: reasons.length === 0, reasons, count: images.length };
}
