import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import MapPage from "@/components/MapPage";

export const metadata = { title: "Map — Roman Martyrology" };

export default async function MapRoute({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edition?: string | string[] }> }) {
  setRequestLocale((await params).locale as Locale);
  const { edition } = await searchParams;
  return <MapPage initialEdition={typeof edition === "string" ? edition : null} />;
}
