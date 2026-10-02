import { defineEventHandler } from "h3";

export default defineEventHandler(() => ({
  ok: true,
  status: "ok",
  service: "betgpt",
  runtime: "server",
  timestamp: new Date().toISOString(),
}));
