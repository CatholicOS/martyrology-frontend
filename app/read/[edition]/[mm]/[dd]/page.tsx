import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { parseDay } from "@/lib/calendar";
import type { Metadata } from "next";
import { monthName } from "@/lib/calendar";
import { editionExists, editionMeta } from "@/lib/server-editions";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata({ params }: { params: Promise<{ edition: string; mm: string; dd: string }> }): Promise<Metadata> {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day) return { title: "Martyrologium" };
  const meta = await editionMeta(edition);
  return { title: `${day.dd} ${monthName(day.mm, "en")} — ${meta ? `${meta.title} ${meta.year}` : edition}` };
}

export default async function DayRoute({ params }: { params: Promise<{ edition: string; mm: string; dd: string }> }) {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day || !(await editionExists(edition))) notFound();
  const viewer = await getViewer();
  return (
    <main className="mx-auto max-w-5xl p-4">
      <Reader edition={edition} mm={day.mm} dd={day.dd} signedIn={viewer.signedIn} />
    </main>
  );
}
