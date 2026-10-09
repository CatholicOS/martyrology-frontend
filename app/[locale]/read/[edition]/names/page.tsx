import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NamesIndex from "@/components/NamesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { namesIndex, type NamesIndexData } from "@/lib/names-index";
import { getPersons } from "@/lib/persons";
import { hasPersons } from "@/lib/persons-editions";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  return { title: t("namesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition }) };
}

/** One edition's index of names, rendered on the server from its catalog and the persons snapshot. */
export default async function NamesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  const e = await editionInfo(edition);
  let index: NamesIndexData | null = null;
  let error = false;
  if (hasPersons(edition)) {
    if (!e) {
      error = true;
    } else {
      try {
        index = namesIndex(await fetchCatalog(edition, editionLang(e)), getPersons(), edition, locale as Locale);
      } catch (err) {
        console.error(`index of names: the catalog of ${edition} could not be loaded`, err);
        error = true;
      }
    }
  }
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <NamesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} error={error} />
    </main>
  );
}
