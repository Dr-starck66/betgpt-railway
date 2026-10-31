import { createFileRoute } from "@tanstack/react-router";
import { handleChatRequest } from "@/lib/chat/stream.server";

/**
 * Production-safe TanStack Start server route.
 * The legacy server/api/chat.post.ts Nitro handler is retained for
 * environments that still use Nitro auto-routing. On TanStack/Vercel,
 * this route guarantees that POST /api/chat is registered by Start.
 */
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => handleChatRequest(request),
    },
  },
});
