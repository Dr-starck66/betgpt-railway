import { defineEventHandler, setHeader } from "h3";
import { robotsTxt } from "../../src/lib/robots";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "text/plain; charset=utf-8");
  setHeader(event, "x-content-type-options", "nosniff");
  return robotsTxt();
});