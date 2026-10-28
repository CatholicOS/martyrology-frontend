import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ApparatusPage from "@/components/ApparatusPage";
import { parseReturn } from "@/lib/reader-return";
import { editionExists, editionMeta } from "@/lib/server-editions";

type Params = Promise<{ locale: string; edition: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  return { title: t("notesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition }) };
}

/** One edition's curators' notes, verified misprints and printed errata, with their eulogies; `?day=&with=`: the reader's, to return to. */
export default async function ApparatusRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <ApparatusPage edition={edition} back={parseReturn(await searchParams, edition)} />
    </main>
  );
}
