import { defineEventHandler, setHeader } from "h3";
import { llmsTxt } from "../../src/lib/geo/llms";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "text/plain; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=3600");
  return llmsTxt();
});
