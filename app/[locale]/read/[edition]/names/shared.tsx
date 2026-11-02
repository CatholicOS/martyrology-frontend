import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NamesIndex from "@/components/NamesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { letterFromSlug, slugLetter } from "@/lib/letters";
import { mentionedIndex } from "@/lib/mentioned-index";
import { namesIndex, type NamesIndexData } from "@/lib/names-index";
import { getPersons } from "@/lib/persons";
import { hasPersons } from "@/lib/persons-editions";
import { NO_RETURN, type ReaderReturn } from "@/lib/reader-return";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

/** Which persons index: of names (the persons commemorated somewhere), or of the persons not commemorated. */
export type PersonsIndexKind = "names" | "mentioned";

const BUILD = { names: namesIndex, mentioned: mentionedIndex } as const;

/** The `<title>` of the index of names (or of persons not commemorated), or of one of its letters' pages. */
export async function namesMetadata(locale: string, edition: string, slug?: string, kind: PersonsIndexKind = "names"): Promise<Metadata> {
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  const title = t(kind === "names" ? "namesTitle" : "mentionedTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition });
  return { title: slug ? `${title} — ${slugLetter(slug)}` : title };
}

/**
 * One edition's index of names (or, `kind` "mentioned", of persons not commemorated), one letter at a time, rendered
 * on the server from its catalog and the persons snapshot: the letter a URL names (404 when the index has none), else
 * the first. `back`: the reader's day and comparison, which the index's links keep.
 */
export async function NamesPage({ locale, edition, slug, back = NO_RETURN, kind = "names" }: {
  locale: string; edition: string; slug?: string; back?: ReaderReturn; kind?: PersonsIndexKind;
}) {
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
        index = BUILD[kind](await fetchCatalog(edition, editionLang(e)), getPersons(), edition, locale as Locale);
      } catch (err) {
        console.error(`${kind === "names" ? "index of names" : "index of persons not commemorated"}: the catalog of ${edition} could not be loaded`, err);
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
      <NamesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} error={error} letter={letter} lang={e ? editionLang(e) : undefined} back={back} kind={kind} />
    </main>
  );
}
