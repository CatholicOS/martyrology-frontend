import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/** The docs before every URL carried a locale: /docs/it/lunar-table → /it/docs/lunar-table. */
const LEGACY_DOCS = /^\/docs\/(en|it)(\/[^/]+)?\/?$/;

/**
 * Every page URL starts with a locale. A legacy docs URL moves for good (308). An unprefixed URL goes to the
 * language the reader picked (the NEXT_LOCALE cookie, written only by the picker); without one, next-intl
 * matches Accept-Language, else English. A prefixed URL is served as asked and never changes the cookie.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const legacy = LEGACY_DOCS.exec(pathname);
  if (legacy) return NextResponse.redirect(new URL(`/${legacy[1]}/docs${legacy[2] ?? ""}${search}`, request.url), 308);
  if (!isLocale(pathname.split("/")[1] ?? "")) {
    const saved = request.cookies.get(LOCALE_COOKIE)?.value ?? "";
    if (isLocale(saved)) return NextResponse.redirect(new URL(`/${saved}${pathname === "/" ? "" : pathname}${search}`, request.url), 307);
  }
  return handleI18nRouting(request);
}

export const config = {
  // Not the route handlers (/api, /scalar/openapi.json, /scalar/proxy), Next's own files, or any file with an extension.
  matcher: ["/((?!api|_next|_vercel|scalar/openapi\\.json|scalar/proxy|.*\\..*).*)"],
};
