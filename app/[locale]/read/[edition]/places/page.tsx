import type { Metadata } from "next";
import { parseReturn } from "@/lib/reader-return";
import { PlacesPage, placesMetadata, placesRole } from "./shared";

type Params = Promise<{ locale: string; edition: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  return placesMetadata(locale, edition);
}

/** One edition's index of places: its first letter, of every role or of the one `?role=` names. */
export default async function PlacesRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition } = await params;
  return PlacesPage({ locale, edition, role: await placesRole(searchParams), back: parseReturn(await searchParams, edition) });
}
