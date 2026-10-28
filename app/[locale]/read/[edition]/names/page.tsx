import type { Metadata } from "next";
import { parseReturn } from "@/lib/reader-return";
import { NamesPage, namesMetadata } from "./shared";

type Params = Promise<{ locale: string; edition: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  return namesMetadata(locale, edition);
}

/** One edition's index of names: its first letter. */
export default async function NamesRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, edition } = await params;
  return NamesPage({ locale, edition, back: parseReturn(await searchParams, edition) });
}
