import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NamesIndex from "@/components/NamesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { letterFromSlug, slugLetter } from "@/lib/letters";
import { namesIndex, type NamesIndexData } from "@/lib/names-index";
import { getPersons } from "@/lib/persons";
import { hasPersons } from "@/lib/persons-editions";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

/** The `<title>` of the index of names, or of one of its letters' pages. */
export async function namesMetadata(locale: string, edition: string, slug?: string): Promise<Metadata> {
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  const title = t("namesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition });
  return { title: slug ? `${title} — ${slugLetter(slug)}` : title };
}

/**
 * One edition's index of names, one letter at a time, rendered on the server from its catalog and the
 * persons snapshot: the letter a URL names (404 when the index has none), else the first.
 */
export async function NamesPage({ locale, edition, slug }: { locale: string; edition: string; slug?: string }) {
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
  let letter: string | undefined;
  if (slug && !error) {
    letter = letterFromSlug(slug, index?.letters.map((l) => l.letter) ?? []) ?? undefined;
    if (!letter) notFound();
  }
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <NamesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} error={error} letter={letter} />
    </main>
  );
}
