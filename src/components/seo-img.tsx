import type { ImgHTMLAttributes } from "react";
import type { ImageSeo } from "@/lib/image-seo";
import { cn } from "@/lib/utils";

/**
 * Image SEO obligatoire pour tout visuel hors écusson (Crest gère sa propre chaîne de logos).
 * alt + title + description (figure/figcaption) + nom de fichier (data-filename).
 */
export function SeoImg({
  seo,
  className,
  priority,
  caption,
  figureClassName,
  ...rest
}: {
  seo: ImageSeo;
  className?: string;
  priority?: boolean;
  caption?: boolean;
  figureClassName?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "title">) {
  const img = (
    <img
      src={seo.src}
      alt={seo.alt}
      title={seo.title}
      width={seo.width}
      height={seo.height}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      data-filename={seo.filename}
      className={className}
      onError={(e) => {
        const node = e.currentTarget;
        if (seo.fallbackSrc && node.dataset.photoFallback !== "used" && node.src !== seo.fallbackSrc) {
          node.dataset.photoFallback = "used";
          node.src = seo.fallbackSrc;
        }
      }}
      {...rest}
    />
  );
  if (!caption) return img;
  return (
    <figure itemScope itemType="https://schema.org/ImageObject" className={cn("overflow-hidden", figureClassName)}>
      {img}
      <meta itemProp="name" content={seo.filename} />
      <meta itemProp="description" content={seo.description} />
      <meta itemProp="contentUrl" content={seo.src} />
      <figcaption itemProp="caption" className="px-3 py-2 text-xs leading-relaxed text-muted">
        {seo.caption}
        {seo.creditUrl && seo.licenseUrl ? (
          <> <a href={seo.creditUrl} rel="noopener noreferrer external" target="_blank" className="underline">Source et auteur</a> · <a href={seo.licenseUrl} rel="noopener noreferrer external" target="_blank" className="underline">Licence Creative Commons</a></>
        ) : null}
      </figcaption>
    </figure>
  );
}
