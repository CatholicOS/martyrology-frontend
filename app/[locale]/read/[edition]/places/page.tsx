import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PlacesIndex from "@/components/PlacesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { getPlaces } from "@/lib/places";
import { placesIndex, type PlacesIndexData } from "@/lib/places-index";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  return { title: t("placesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition }) };
}

/** One edition's index of places, rendered on the server from its catalog and the places snapshot. */
export default async function PlacesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
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
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <PlacesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} />
    </main>
  );
}
