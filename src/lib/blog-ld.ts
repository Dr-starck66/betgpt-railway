import type { BlogArticle } from "@/lib/blog";
import { BLOG } from "@/lib/blog";
import { blogCover, blogInline } from "@/lib/blog-rich";
import { BRAND_LOGO, imageObjectLd } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";

export function blogHubLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog BetGPT — pronostics, cotes, live",
    url: `${SITE_URL}/blog`,
    inLanguage: "fr-FR",
    publisher: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL },
    blogPost: BLOG.map((a) => ({
      "@type": "BlogPosting",
      headline: a.h1,
      url: `${SITE_URL}/blog/${a.slug}`,
      datePublished: a.published,
      image: `${SITE_URL}${blogCover(a).src}`,
    })),
  };
}

export function blogArticleLd(a: BlogArticle) {
  const url = `${SITE_URL}/blog/${a.slug}`;
  const cover = blogCover(a);
  const inline = blogInline(a);
  const img = (b: ReturnType<typeof blogCover>) => imageObjectLd(b, url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: a.h1,
        description: a.lead,
        datePublished: a.published,
        dateModified: a.published,
        inLanguage: "fr-FR",
        url,
        mainEntityOfPage: url,
        articleSection: a.section,
        keywords: a.keywords,
        wordCount: Math.max(400, a.lead.length + a.paragraphs.reduce((n, p) => n + p.body.length, 0)),
        articleBody: [a.lead, ...a.paragraphs.map((p) => `${p.h2}. ${p.body}`), ...a.faq.map((f) => `${f.q} ${f.a}`)].join("\n\n"),
        author: { "@type": "Organization", name: "Rédaction BetGPT", url: `${SITE_URL}/redaction` },
        publisher: {
          "@type": "NewsMediaOrganization",
          name: "BetGPT",
          url: SITE_URL,
          logo: imageObjectLd(BRAND_LOGO, SITE_URL),
        },
        image: [img(cover), img(inline)],
        thumbnailUrl: `${SITE_URL}${cover.src}`,
        speakable: { "@type": "SpeakableSpecification", cssSelector: [".seo-answer", "h1", "h2"] },
        hasPart: a.paragraphs.map((p) => ({ "@type": "WebPageElement", name: p.h2 })),
      },
      {
        "@type": "FAQPage",
        mainEntity: a.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}
