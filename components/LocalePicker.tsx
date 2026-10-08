"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/i18n/routing";

/** Saves the reader's language for unprefixed URLs: the only place NEXT_LOCALE is written. */
export function writeLocaleCookie(locale: Locale, secure: boolean): string {
  const cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
  document.cookie = cookie;
  return cookie;
}

/**
 * The header's language picker: each language in its own name. Choosing one saves it and opens the same page
 * in that language, with its query and #hash, except on docs pages, whose anchors differ by language.
 */
export function LocalePicker() {
  const locale = useLocale();
  const t = useTranslations("Header");
  const pathname = usePathname();
  const router = useRouter();
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">{t("language")}</label>
      <select
        id={id}
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          writeLocaleCookie(next, window.location.protocol === "https:");
          const hash = pathname.startsWith("/docs") ? "" : window.location.hash;
          router.replace(`${pathname}${window.location.search}${hash}`, { locale: next });
        }}
        className="rounded border border-slate-300 bg-transparent px-1 py-0.5 text-sm dark:border-slate-700"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>
        ))}
      </select>
    </span>
  );
}
