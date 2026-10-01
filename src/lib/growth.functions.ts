import { createServerFn } from "@tanstack/react-start";
import { buildNationalBreakout } from "@/lib/growth/server";

export const getNationalBreakout = createServerFn({ method: "GET" }).handler(async () => {
  return buildNationalBreakout(24);
});
