import { GEO_PAGES, GEO_REVISION } from "@/lib/geo/entity";

export type ChangelogEntry = {
  path: string;
  created: string;
  modified: string;
  reason: string;
};

export function editorialChangelog(): ChangelogEntry[] {
  return GEO_PAGES.map((page) => ({
    path: page.path,
    created: GEO_REVISION,
    modified: page.updated,
    reason: page.answer,
  }));
}

export function changelogDocument(): {
  updated: string;
  note: string;
  pages: ChangelogEntry[];
} {
  return {
    updated: GEO_REVISION,
    note: "Révision éditoriale. Les versions de pronostic vivent sur chaque fiche de match et ne sont pas antidatées ici.",
    pages: editorialChangelog(),
  };
}
