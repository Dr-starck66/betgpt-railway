import { createServerFn } from "@tanstack/react-start";
import { getCiteData } from "@/engine/cite";

export const loadCite = createServerFn({ method: "GET" }).handler(async () => getCiteData());
