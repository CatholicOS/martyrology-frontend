import { getViewer } from "@/lib/viewer";
import { readChangeset } from "@/lib/changesets";

// See ../route.ts: curators only, a 404 for everyone else, never cached.
const PRIVATE = { "cache-control": "private, no-store" };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const body = (await getViewer()).curator ? await readChangeset(name) : null;
  if (body === null) return new Response("Not found", { status: 404, headers: PRIVATE });
  return new Response(body, { headers: { ...PRIVATE, "content-type": "application/json; charset=utf-8" } });
}
