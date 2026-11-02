import type { Metadata } from "next";
import { parseReturn } from "@/lib/reader-return";
import { NamesPage, namesMetadata } from "../../names/shared";

type Params = Promise<{ locale: string; edition: string; letter: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition, letter } = await params;
  return namesMetadata(locale, edition, letter, "mentioned");
}

/** One letter of an edition's index of persons not commemorated. */
export default async function MentionedLetterRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition, letter } = await params;
  return NamesPage({ locale, edition, slug: letter, back: parseReturn(await searchParams, edition), kind: "mentioned" });
}
