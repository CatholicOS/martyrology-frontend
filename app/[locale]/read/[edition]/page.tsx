import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import TodayRedirect from "@/components/TodayRedirect";
import { editionExists } from "@/lib/server-editions";

export default async function EditionRoute({ params }: { params: Promise<{ locale: string; edition: string }> }) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  return <TodayRedirect edition={edition} />;
}
