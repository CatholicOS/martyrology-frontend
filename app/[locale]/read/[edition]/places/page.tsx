import type { Metadata } from "next";
import { PlacesPage, placesMetadata } from "./shared";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  return placesMetadata(locale, edition);
}

/** One edition's index of places: its first letter. */
export default async function PlacesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
  return PlacesPage({ locale, edition });
}
