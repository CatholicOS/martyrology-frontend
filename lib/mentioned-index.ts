import type { Locale } from "@/i18n/routing";
import { isCommemorated, personsIndex, type NamesIndexData } from "@/lib/names-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

/**
 * An edition's index of persons not commemorated: the persons its printed eulogies only mention whom no eulogy of
 * the snapshot commemorates, or who have no item (each apart by eulogy, keyed `name:<name>#<n|1>@<eulogy>`), with
 * the eulogies that mention each, laid out as the index of names. Null when crmedr has no persons for the edition.
 */
export function mentionedIndex(catalog: CatalogEntryOut[], snap: PersonsSnapshot, edition: string, locale: Locale): NamesIndexData | null {
  return personsIndex(catalog, snap, edition, locale, (p) => !isCommemorated(p, snap));
}
