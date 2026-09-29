import { createServerFn } from "@tanstack/react-start";
import { performanceRows } from "@/lib/editorial/feed";
import { editionFromDesk } from "@/lib/editorial/run.server";

export { editionFromDesk } from "@/lib/editorial/run.server";

export const getEditorialEdition = createServerFn({ method: "GET" }).handler(async () => {
  const { edition } = await editionFromDesk();
  return edition;
});

export const getEditorialAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { edition, durable } = await editionFromDesk();
  return {
    edition,
    performance: performanceRows(edition.articles),
    ledgerPersisted: durable,
  };
});
