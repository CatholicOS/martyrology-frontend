import snapshot from "@/data/registry-snapshot.json";

export interface SnapshotEntry {
  deprecated: boolean;
  month: number;
  day: number;
  entry: number | null;
  asterisk: boolean;
  unnumbered: boolean;
  country: string | null;
  attested_in?: string | null;
  subject: { la: string; it: string; en: string };
  /** What a eulogy that commemorates no single person commemorates as a whole (crmedr data/eulogy_items.json). */
  item?: EulogyItem;
}

export type EulogyItemKind = "group" | "feast" | "dedication" | "translation";

export interface EulogyItem {
  wikidata: string;
  kind: EulogyItemKind;
}

export type RegistrySnapshot = Record<string, SnapshotEntry>;

export function getSnapshot(): RegistrySnapshot {
  return snapshot as RegistrySnapshot;
}

export async function loadSnapshot(): Promise<RegistrySnapshot> {
  return getSnapshot();
}
