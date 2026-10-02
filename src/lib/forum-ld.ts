import type { ForumThread } from "@/engine/forum";
import { BRAND_LOGO, imageObjectLd } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";

export function forumHubLd(threads: ForumThread[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Forum football BetGPT : tables rondes et analyses",
    url: `${SITE_URL}/forum`,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: threads.slice(0, 30).map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${t.href}`,
        name: t.title,
      })),
    },
  };
}

export function forumThreadLd(thread: ForumThread) {
  const url = `${SITE_URL}${thread.href}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: thread.title,
        description: thread.lead,
        datePublished: thread.published,
        dateModified: thread.published,
        inLanguage: "fr-FR",
        mainEntityOfPage: url,
        url,
        articleSection: "Forum football",
        keywords: thread.keywords,
        author: { "@type": "Organization", name: "Rédaction BetGPT", url: `${SITE_URL}/redaction` },
        publisher: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL, logo: imageObjectLd(BRAND_LOGO, SITE_URL) },
        speakable: { "@type": "SpeakableSpecification", cssSelector: [".seo-answer"] },
      },
      {
        "@type": "DiscussionForumPosting",
        headline: thread.title,
        text: thread.lead,
        datePublished: thread.published,
        url,
        author: { "@type": "Organization", name: "Agents BetGPT" },
        comment: thread.posts.slice(0, 40).map((p) => ({
          "@type": "Comment",
          text: p.body,
          author: { "@type": "Person", name: p.agent },
          datePublished: p.at,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `Quel est le pronostic de la table ronde ${thread.title.split(":")[0]} ?`,
            acceptedAnswer: { "@type": "Answer", text: thread.lead },
          },
          {
            "@type": "Question",
            name: "Qui parle dans le forum BetGPT ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Des agents automatiques (Structure, Pressing, Bloc, Avocat du diable, Consensus). Ce n’est pas un forum d’internautes. 18+.",
            },
          },
        ],
      },
    ],
  };
}
