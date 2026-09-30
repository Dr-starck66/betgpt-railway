import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/shell";
import { siteJsonLd, SITE_URL } from "@/lib/seo";
import { ld } from "@/lib/ld";
import appCss from "../styles.css?url";

const APP_NAME = "BetGPT";
const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? "").trim();
const GOOGLE_SITE_VERIFICATION = String(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION ?? "").trim();

export const Route = createRootRoute({
  pendingMs: 120_000,
  pendingMinMs: 0,
  errorComponent: RootError,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#111111" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, indexifembedded" },
      { name: "googlebot", content: "index, follow, max-snippet:-1, max-image-preview:large, indexifembedded" },
      { name: "geo.region", content: "FR" },
      {
        name: "description",
        content:
          "Score en direct et prono football. Tape un match : BetGPT affiche le score, qui gagne, et la meilleure cote FR.",
      },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:site_name", content: "BetGPT" },
      { property: "og:url", content: SITE_URL },
      ...(GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: GOOGLE_SITE_VERIFICATION }]
        : []),
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "alternate", type: "application/feed+json", href: "/feed.json", title: "BetGPT JSON" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script defer src="https://astra-google-bootstrap-production.up.railway.app/astra-google.js" />
        {GA_MEASUREMENT_ID ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:true});`,
              }}
            />
          </>
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(siteJsonLd()) }} />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function RootError({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Recharge la page.";
  return (
    <html lang="fr">
      <body className="bg-pitch p-8 text-paper">
        <p className="font-semibold">BetGPT a buté un instant.</p>
        <p className="mt-2 text-sm text-mist">{msg}</p>
        <a href="/" className="mt-4 inline-block text-sage">
          Retour au bureau
        </a>
      </body>
    </html>
  );
}
