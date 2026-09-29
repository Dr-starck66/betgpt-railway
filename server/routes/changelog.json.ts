import { defineEventHandler, setHeader } from "h3";
import { changelogDocument } from "../../src/lib/geo/changelog";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600");
  return changelogDocument();
});
