import type { Metadata } from "next";
import { parseReturn } from "@/lib/reader-return";
import { NamesPage, namesMetadata } from "../names/shared";

type Params = Promise<{ locale: string; edition: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  return namesMetadata(locale, edition, undefined, "mentioned");
}

/** One edition's index of persons not commemorated: its first letter. */
export default async function MentionedRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition } = await params;
  return NamesPage({ locale, edition, back: parseReturn(await searchParams, edition), kind: "mentioned" });
}
