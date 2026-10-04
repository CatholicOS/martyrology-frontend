import { getViewer } from "@/lib/viewer";
import { listChangesets } from "@/lib/changesets";

// Curators only, like /review itself: everyone else gets a 404 rather than a
// hint the change-sets exist. Never cached: the answer depends on the viewer.
const PRIVATE = { "cache-control": "private, no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getViewer()).curator) return new Response("Not found", { status: 404, headers: PRIVATE });
  return Response.json({ changesets: await listChangesets() }, { headers: PRIVATE });
}
