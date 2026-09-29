import { isSandboxPreviewGuestHost } from "@/lib/preview-embedder-origin";

/** True when the app runs in the Grok live-preview iframe (cookies often blocked). */
export function isEmbeddedPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  if (isSandboxPreviewGuestHost(host)) return true;
  if (host === "grok.com" || host.endsWith(".grok.com")) return true;
  try {
    const ao = window.location.ancestorOrigins;
    if (ao && ao.length > 0) return true;
  } catch {
    return true;
  }
  try {
    const ref = document.referrer.toLowerCase();
    if (ref.includes("grok.com") || ref.includes("grok-sandbox.com")) return true;
  } catch {
    /* */
  }
  return false;
}

/** Dev server / Grok preview: never lock the UI behind storage or overlays. */
export function isPreviewSurface(): boolean {
  if (import.meta.env.DEV) return true;
  return isEmbeddedPreview();
}
