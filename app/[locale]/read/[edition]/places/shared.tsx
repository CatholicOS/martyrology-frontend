import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PlacesIndex from "@/components/PlacesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { letterFromSlug, slugLetter } from "@/lib/letters";
import { getPlaces } from "@/lib/places";
import { placesIndex, type PlacesIndexData } from "@/lib/places-index";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

/** The `<title>` of the index of places, or of one of its letters' pages. */
export async function placesMetadata(locale: string, edition: string, slug?: string): Promise<Metadata> {
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  const title = t("placesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition });
  return { title: slug ? `${title} — ${slugLetter(slug)}` : title };
}

/**
 * One edition's index of places, one letter at a time, rendered on the server from its catalog and
 * the places snapshot: the letter a URL names (404 when the index has none), else the first.
 */
export async function PlacesPage({ locale, edition, slug }: { locale: string; edition: string; slug?: string }) {
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  const e = await editionInfo(edition);
  let index: PlacesIndexData | null = null;
  if (e) {
    try {
      index = placesIndex(await fetchCatalog(edition, editionLang(e)), getPlaces(), edition, locale as Locale);
    } catch (err) {
      // The API could not give the catalog: PlacesIndex says so and offers to try again; the log says why.
      console.error(`index of places: the catalog of ${edition} could not be loaded`, err);
      index = null;
    }
  }
  let letter: string | undefined;
  if (slug && index) {
    letter = letterFromSlug(slug, index.letters.map((l) => l.letter)) ?? undefined;
    if (!letter) notFound();
  }
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <PlacesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} letter={letter} />
    </main>
  );
}
