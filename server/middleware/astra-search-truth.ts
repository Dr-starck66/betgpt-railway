import { defineEventHandler, getRequestHeader, getRequestURL } from "h3";
import { classifySearchReferrer, isHumanSearchLandingRequest } from "../../src/lib/search/search-truth";
import { recordSearchTruthLanding } from "../../src/lib/store";

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const referrer = getRequestHeader(event, "referer") || getRequestHeader(event, "referrer") || "";
  const source = classifySearchReferrer(referrer);
  if (!source) return;

  const human = isHumanSearchLandingRequest({
    method: event.node?.req.method ?? "GET",
    pathname: url.pathname,
    userAgent: getRequestHeader(event, "user-agent") || "",
    secFetchDest: getRequestHeader(event, "sec-fetch-dest") || "",
  });
  if (!human) return;

  // Store only the search engine and landing path. Never store IPs, query terms,
  // cookies or full referrer URLs.
  await recordSearchTruthLanding(source, url.pathname || "/");
});
