import { isLocale } from "@/i18n/routing";
import { localePaths, localeSitemap, sitemapData } from "@/lib/sitemap";

// Asked for on each request (the API's answers are in the data cache for an hour): the build cannot
// reach the API, and an edition the API publishes belongs in the sitemap without a redeploy.
export const dynamic = "force-dynamic";

/** One language's sitemap, at /sitemap/<locale>.xml; /sitemap.xml is their index. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const locale = /^(.+)\.xml$/.exec((await params).file)?.[1] ?? "";
  if (!isLocale(locale)) return new Response("Not Found", { status: 404 });
  return new Response(localeSitemap(locale, localePaths(await sitemapData())), { headers: { "Content-Type": "application/xml" } });
}
