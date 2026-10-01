import { defineEventHandler, setHeader } from "h3";

export default defineEventHandler((event) => {
  const revision =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.ASTRA_DEPLOY_REV ||
    "unknown";

  setHeader(event, "cache-control", "no-store");
  setHeader(event, "x-astra-public-revision", revision);

  return {
    status: "ok",
    service: "betgpt",
    revision,
  };
});
