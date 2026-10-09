import type { Metadata } from "next";
import { NamesPage, namesMetadata } from "./shared";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  return namesMetadata(locale, edition);
}

/** One edition's index of names: its first letter. */
export default async function NamesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
  return NamesPage({ locale, edition });
}
