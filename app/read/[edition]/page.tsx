import { notFound } from "next/navigation";
import TodayRedirect from "@/components/TodayRedirect";
import { editionExists } from "@/lib/server-editions";

export default async function EditionRoute({ params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params;
  if (!(await editionExists(edition))) notFound();
  return <TodayRedirect edition={edition} />;
}
