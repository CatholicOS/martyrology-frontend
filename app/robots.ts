import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    // Not /api as a whole: the pages read their texts through /api/mr, and a crawler that renders them needs it.
    rules: { userAgent: "*", allow: "/", disallow: "/api/auth/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
