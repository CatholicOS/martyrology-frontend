import type { Metadata } from "next";
import { PlacesPage, placesMetadata } from "../shared";

type Params = Promise<{ locale: string; edition: string; letter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition, letter } = await params;
  return placesMetadata(locale, edition, letter);
}

/** One letter of an edition's index of places. */
export default async function PlacesLetterRoute({ params }: { params: Params }) {
  const { locale, edition, letter } = await params;
  return PlacesPage({ locale, edition, slug: letter });
}
