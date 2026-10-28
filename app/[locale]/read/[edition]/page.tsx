import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import TodayRedirect from "@/components/TodayRedirect";
import { parseReturn } from "@/lib/reader-return";
import { editionExists } from "@/lib/server-editions";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Today's page of an edition; `?with=` opens it compared with that edition (the day's page checks it). */
export default async function EditionRoute({ params, searchParams }: {
  params: Promise<{ locale: string; edition: string }>; searchParams?: SearchParams;
}) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  return <TodayRedirect edition={edition} withEdition={parseReturn(await searchParams, edition).with} />;
}
