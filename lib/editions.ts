import type { AccessMap, EditionOut } from "@/lib/types";
import type { Lang } from "@/lib/calendar";

export type ShelfState = "open" | "locked" | "unavailable";

const TITLES: Record<Lang, string> = {
  la: "MARTYROLOGIUM ROMANUM",
  it: "MARTIROLOGIO ROMANO",
  en: "ROMAN MARTYROLOGY",
};

const LABELS: Record<Lang, string> = { la: "Latin", it: "Italiano (CEI)", en: "English" };

export function editionLang(e: EditionOut): Lang {
  if (e.locale.startsWith("it")) return "it";
  if (e.locale.startsWith("en")) return "en";
  return "la";
}

export function editionTitle(e: EditionOut): string {
  return TITLES[editionLang(e)];
}

export function languageLabel(e: EditionOut): string {
  return LABELS[editionLang(e)];
}

function natureRank(e: EditionOut): number {
  if (e.nature.startsWith("editio_typica")) return 0;
  return e.nature === "editio_vernacula" ? 1 : 2;
}

/** "editio_typica_recognita" → "Editio typica recognita". */
export function natureLabel(nature: string): string {
  const s = nature.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A Latin editio typica, as opposed to a vernacular edition or a translation. */
export function isOriginal(e: EditionOut): boolean {
  return natureRank(e) === 0;
}

export function sortForShelf(es: EditionOut[]): EditionOut[] {
  return [...es].sort(
    (a, b) => b.year - a.year || natureRank(a) - natureRank(b) || a.edition_id.localeCompare(b.edition_id),
  );
}

/**
 * `access` is null when /access could not be loaded: every available book is
 * then offered as open, and the reader shows the locked state if the API
 * redacts the texts.
 */
export function shelfState(e: EditionOut, access: AccessMap | null): ShelfState {
  if (e.availability.status === "unavailable") return "unavailable";
  if (access === null) return "open";
  return access[e.edition_id]?.can_read_texts ? "open" : "locked";
}

/** "MARTYROLOGIUM ROMANUM" → "Martyrologium Romanum", for accessible names and notices. */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const LANGUAGE_NAMES: Record<Lang, string> = { la: "Latin", it: "Italian", en: "English" };

/** "1914 English", for notices. */
export function yearAndLanguage(e: EditionOut): string {
  return `${e.year} ${LANGUAGE_NAMES[editionLang(e)]}`;
}

/** How a note names `e` beside `other`: by its year, or by year and language when the two share a year. */
export function shortName(e: EditionOut, other: EditionOut): string {
  return e.year === other.year ? yearAndLanguage(e) : String(e.year);
}
