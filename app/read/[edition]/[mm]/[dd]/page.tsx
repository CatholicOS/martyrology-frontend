import { notFound, redirect } from "next/navigation";
import Reader from "@/components/Reader";
import { dayPath, monthName, parseDay } from "@/lib/calendar";
import type { Metadata } from "next";
import { editionExists, editionMeta } from "@/lib/server-editions";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ edition: string; mm: string; dd: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** The second edition of a pairing (`?with=`); a missing or repeated parameter is no pairing. */
async function withParam(searchParams?: SearchParams): Promise<string | null> {
  const w = (await searchParams)?.with;
  return typeof w === "string" && w ? w : null;
}

const named = (meta: { title: string; year: number } | null, id: string) => (meta ? `${meta.title} ${meta.year}` : id);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams?: SearchParams }): Promise<Metadata> {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day) return { title: "Martyrologium" };
  const w = await withParam(searchParams);
  const books = [named(await editionMeta(edition), edition)];
  if (w && w !== edition) books.push(named(await editionMeta(w), w));
  return { title: `${day.dd} ${monthName(day.mm, "en")} — ${books.join(" | ")}` };
}

export default async function DayRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day || !(await editionExists(edition))) notFound();
  const w = await withParam(searchParams);
  if (w !== null && (w === edition || !(await editionExists(w)))) redirect(dayPath(edition, day));
  const viewer = await getViewer();
  return (
    <main className={w ? "mx-auto max-w-7xl p-4" : "mx-auto max-w-5xl p-4"}>
      <Reader edition={edition} mm={day.mm} dd={day.dd} signedIn={viewer.signedIn} withEdition={w} />
    </main>
  );
}
