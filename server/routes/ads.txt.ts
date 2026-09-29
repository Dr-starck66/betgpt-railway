import { defineEventHandler, setHeader } from "h3";
import { loadAdmin } from "../../src/engine/admin";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "text/plain; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=300");
  const pub = (loadAdmin().adsensePub ?? "").replace(/^ca-/, "").trim();
  if (!pub.startsWith("pub-")) {
    return "# ads.txt — coller l'ID AdSense (pub-xxxxxxxx) dans Réglages une fois le compte créé.\n";
  }
  return `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;
});
