"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 * The header's language picker: a globe button that opens the languages, each in its own name, the current one
 * marked. Choosing one saves it and opens the same page in that language, with its query and #hash, except on docs
 * pages, whose anchors differ by language. The list closes on a choice, on Escape (focus back on the globe) and on a
 * click outside; Escape stops here, so it doesn't also close the header's mobile panel around the picker.
 */
export function LocalePicker() {
  const locale = useLocale();
  const t = useTranslations("Header");
  const pathname = usePathname();
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    writeLocaleCookie(next, window.location.protocol === "https:");
    const hash = pathname.startsWith("/docs") ? "" : window.location.hash;
    router.replace(`${pathname}${window.location.search}${hash}`, { locale: next });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("language")}
        aria-expanded={open}
        aria-controls={listId}
        title={t("language")}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 3.75 5.5 3.75 9S14.5 18.5 12 21M12 3C9.5 5.5 8.25 8.5 8.25 12S9.5 18.5 12 21" />
        </svg>
        {/* The current language's code beside the globe, so the setting reads at a glance; the label names it for screen readers. */}
        <span aria-hidden="true" className="text-xs font-semibold uppercase">{locale}</span>
      </button>
      {open && (
        <ul
          id={listId}
          className="z-50 mt-2 flex min-w-36 flex-col rounded border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-950 sm:absolute sm:right-0 sm:top-full"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                lang={l}
                aria-current={l === locale ? "true" : undefined}
                onClick={() => choose(l)}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 aria-[current=true]:font-semibold aria-[current=true]:text-[#a3161b] dark:hover:bg-slate-800 dark:aria-[current=true]:text-red-400"
              >
                {LOCALE_NAMES[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
