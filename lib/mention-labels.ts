import type { Locale } from "@/i18n/routing";
import type { Labels } from "@/lib/entities";

/**
 * A text in the interface language, else in English, else `fallback` (in `fallbackLang`), with the language it
 * is in, so the page can tag it; null when there is none.
 */
export function inLanguage(
  labels: Labels | undefined, locale: Locale, fallback: string | null, fallbackLang: string | null,
): { text: string; lang: string | null } | null {
  const own = labels?.[locale];
  if (own) return { text: own, lang: locale };
  if (labels?.en) return { text: labels.en, lang: "en" };
  return fallback ? { text: fallback, lang: fallbackLang } : null;
}
