import type { Metadata } from "next";
import { parseReturn } from "@/lib/reader-return";
import { PlacesPage, placesMetadata, placesRole } from "../shared";

type Params = Promise<{ locale: string; edition: string; letter: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition, letter } = await params;
  return placesMetadata(locale, edition, letter);
}

/** One letter of an edition's index of places, of every role or of the one `?role=` names. */
export default async function PlacesLetterRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition, letter } = await params;
  return PlacesPage({ locale, edition, slug: letter, role: await placesRole(searchParams), back: parseReturn(await searchParams, edition) });
}
