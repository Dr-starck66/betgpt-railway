import { createServerFn } from "@tanstack/react-start";
import { performanceRows } from "@/lib/editorial/feed";

export const getEditorialEdition = createServerFn({ method: "GET" }).handler(async () => {
  const { editionFromDesk } = await import("@/lib/editorial/run.server");
  const { edition } = await editionFromDesk();
  return edition;
});

export const getEditorialAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { editionFromDesk } = await import("@/lib/editorial/run.server");
  const { edition, durable } = await editionFromDesk();
  return {
    edition,
    performance: performanceRows(edition.articles),
    ledgerPersisted: durable,
  };
});
