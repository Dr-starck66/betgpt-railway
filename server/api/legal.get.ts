import { defineEventHandler, setHeader } from "h3";
import { legalIdentity } from "../../src/lib/legal";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=60");
  const l = legalIdentity();
  return { adsensePub: l.adsensePub, ready: l.ready, name: l.name };
});
