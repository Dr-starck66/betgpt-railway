import { Fragment } from "react";
import { extractBroadcasters, tokenizeBroadcasterText } from "@/lib/broadcaster-links";

export function BroadcasterText({ text }: { text: string }) {
  return (
    <>
      {tokenizeBroadcasterText(text).map((token, index) =>
        token.kind === "link" ? (
          <a
            key={`${token.key}-${index}`}
            href={token.href}
            target="_blank"
            rel={token.sponsored ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
            className="font-semibold text-link underline decoration-link/40 underline-offset-2 hover:decoration-link"
            data-broadcaster={token.key}
            data-affiliate-ready="true"
          >
            {token.text}
          </a>
        ) : (
          <Fragment key={`text-${index}`}>{token.text}</Fragment>
        ),
      )}
    </>
  );
}

export function BroadcastLinks({ texts }: { texts: string[] }) {
  const broadcasters = extractBroadcasters(texts);
  if (!broadcasters.length) return null;

  return (
    <section className="surface-card p-5" aria-label="Diffusion du match">
      <h2 className="text-base font-semibold text-paper">Diffusion</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Accès externe vers le site du diffuseur cité dans l’article.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {broadcasters.map((broadcaster) => (
          <li key={broadcaster.key}>
            <a
              href={broadcaster.href}
              target="_blank"
              rel={broadcaster.sponsored ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
              className="chip-pill font-semibold hover:border-sage/30 hover:text-link"
              data-broadcaster={broadcaster.key}
              data-affiliate-ready="true"
              data-affiliate-capable={broadcaster.affiliateCapable ? "true" : "false"}
              data-affiliate-network={broadcaster.affiliateNetwork}
            >
              {broadcaster.text} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
