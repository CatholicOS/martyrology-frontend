import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import MapPage from "@/components/MapPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "Metadata" });
  return { title: t("titleWithBook", { title: t("map"), book: t("bookTitle") }) };
}

export default async function MapRoute({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edition?: string | string[] }> }) {
  setRequestLocale((await params).locale as Locale);
  const { edition } = await searchParams;
  return <MapPage initialEdition={typeof edition === "string" ? edition : null} />;
}
