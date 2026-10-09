import { sitemapIndex } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** The sitemap index, which names each language's sitemap (app/sitemap.ts). */
export function GET() {
  return new Response(sitemapIndex(), { headers: { "Content-Type": "application/xml" } });
}
