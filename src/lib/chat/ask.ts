import { createServerFn } from "@tanstack/react-start";
import type { ChatRequestBody } from "./types";
import { chatBodySchema } from "@/lib/schemas";
import { allowChat, captureClientIp } from "@/engine/guard";

export const askChat = createServerFn({ method: "POST" })
  .validator((data: ChatRequestBody) => chatBodySchema.parse(data) as ChatRequestBody)
  .handler(async ({ data }) => {
    await captureClientIp();
    if (!(await allowChat())) return { ok: false as const, error: "Trop de messages. Patiente une minute." };
    const { completeChat } = await import("./complete");
    return completeChat(data);
  });
