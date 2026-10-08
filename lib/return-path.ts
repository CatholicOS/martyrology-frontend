import { isLocale } from "@/i18n/routing";

/**
 * Where sign-in should return: the page the reader was on, but only if it is a
 * same-origin path under a known locale prefix ("/it/docs?x=1"). Anything else
 * (absolute URLs, "//host", unprefixed paths, non-strings) falls back to "/{locale}",
 * so the form value can never become an open redirect.
 */
export function safeReturnPath(raw: unknown, locale: string): string {
  const fallback = `/${locale}`;
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.includes("\\")) return fallback;
  const [pathAndQuery] = raw.split("#");
  const [path] = pathAndQuery.split("?");
  const segments = path.split("/");
  // "/it/docs" -> ["", "it", "docs"]; an empty later segment means "//".
  if (!isLocale(segments[1] ?? "") || segments.slice(2).some((s, i, a) => s === "" && i < a.length - 1)) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return pathAndQuery;
}
