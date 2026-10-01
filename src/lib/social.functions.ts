import { createServerFn } from "@tanstack/react-start";

export const getSocialAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { socialAdminSnapshot } = await import("@/lib/social/run.server");
  return socialAdminSnapshot();
});
