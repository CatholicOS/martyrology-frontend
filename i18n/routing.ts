import { defineRouting } from "next-intl/routing";

/** The interface languages, English first. Every page URL starts with one: /it/docs, /fr/read/… */
export const LOCALES = ["en", "it", "fr", "de", "es", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

/** The reader's choice, written only by the language picker (never by visiting a prefixed URL). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language in its own name, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", it: "Italiano", fr: "Français", de: "Deutsch", es: "Español", pt: "Português",
};

// localeCookie: false — next-intl neither reads nor writes a cookie; proxy.ts reads ours, the picker writes it.
export const routing = defineRouting({ locales: LOCALES, defaultLocale: "en", localePrefix: "always", localeCookie: false });

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}
