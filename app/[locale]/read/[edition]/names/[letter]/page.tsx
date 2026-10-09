import type { Metadata } from "next";
import { NamesPage, namesMetadata } from "../shared";

type Params = Promise<{ locale: string; edition: string; letter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition, letter } = await params;
  return namesMetadata(locale, edition, letter);
}

/** One letter of an edition's index of names. */
export default async function NamesLetterRoute({ params }: { params: Params }) {
  const { locale, edition, letter } = await params;
  return NamesPage({ locale, edition, slug: letter });
}
