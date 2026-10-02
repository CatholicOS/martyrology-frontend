import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import ComparePage from "@/components/ComparePage";

// The catalog diff is a curation tool: curators only (admin or martyrology_editor).
// Readers compare editions side by side in the reader (?with=).
export default async function CompareRoute() {
  const viewer = await getViewer();
  if (!viewer.curator) notFound();
  return <ComparePage />;
}
