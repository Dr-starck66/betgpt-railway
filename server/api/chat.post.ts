import { defineEventHandler, getRequestHeader, readRawBody } from "h3";
import { handleChatRequest } from "../../src/lib/chat/stream.server";

export default defineEventHandler(async (event) => {
  const declaredLength = Number(getRequestHeader(event, "content-length"));
  if (declaredLength > 65536)
    return Response.json({ error: "Message trop volumineux." }, { status: 413 });
  const raw = (await readRawBody(event, false)) ?? new Uint8Array();
  if (raw.byteLength > 65536)
    return Response.json({ error: "Message trop volumineux." }, { status: 413 });
  const host =
    getRequestHeader(event, "x-forwarded-host") ?? getRequestHeader(event, "host") ?? "localhost";
  const proto = getRequestHeader(event, "x-forwarded-proto") ?? "https";
  const request = new Request(`${proto}://${host}/api/chat`, {
    method: "POST",
    headers: { "content-type": getRequestHeader(event, "content-type") ?? "application/json" },
    body: raw as BodyInit,
  });
  return handleChatRequest(request);
});
