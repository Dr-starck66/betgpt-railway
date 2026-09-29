import { createServerFn } from "@tanstack/react-start";

const EMPTY = {
  on: false,
  webhookSet: false,
  pending: 0,
  sent: 0,
  nextDue: null as number | null,
  lastError: null as string | null,
};

export const getBroadcast = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("@/engine/guard");
    if (!verifyAdminToken(data.token)) return EMPTY;
    const { broadcastStatus } = await import("@/engine/broadcast");
    return broadcastStatus();
  });

export const setBroadcast = createServerFn({ method: "POST" })
  .validator((data: { token: string; webhook?: string; on?: boolean }) => data)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("@/engine/guard");
    if (!verifyAdminToken(data.token)) return EMPTY;
    const { saveBroadcast } = await import("@/engine/broadcast");
    const { token: _t, ...rest } = data;
    return saveBroadcast(rest);
  });

export const getPredictionHook = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("@/engine/guard");
    if (!verifyAdminToken(data.token)) return { url: "" };
    const { predictionHookUrl } = await import("@/engine/prediction-hook");
    return { url: predictionHookUrl() };
  });

export const setPredictionHook = createServerFn({ method: "POST" })
  .validator((data: { token: string; url: string }) => data)
  .handler(async ({ data }) => {
    const { verifyAdminToken } = await import("@/engine/guard");
    if (!verifyAdminToken(data.token)) return { url: "" };
    const { setPredictionHookUrl } = await import("@/engine/prediction-hook");
    return { url: setPredictionHookUrl(data.url) };
  });
