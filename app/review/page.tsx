import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import ReviewPage from "@/components/ReviewPage";

// Change-set review is a back-office tool: curators only (admin or
// martyrology_editor). Everyone else gets a 404 rather than a hint it exists.
export default async function ReviewRoute() {
  const viewer = await getViewer();
  if (!viewer.curator) notFound();
  return <ReviewPage />;
}
