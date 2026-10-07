import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ApparatusPage from "@/components/ApparatusPage";
import { editionExists, editionMeta } from "@/lib/server-editions";

type Params = Promise<{ edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { edition } = await params;
  const meta = await editionMeta(edition);
  return { title: `${meta ? `${meta.title} ${meta.year}` : edition}: notes, misprints and errata` };
}

/** One edition's curators' notes, verified misprints and printed errata, with their eulogies. */
export default async function ApparatusRoute({ params }: { params: Params }) {
  const { edition } = await params;
  if (!(await editionExists(edition))) notFound();
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <ApparatusPage edition={edition} />
    </main>
  );
}
