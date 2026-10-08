"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { DOC_PAGES, DOC_PARTS, docHref, slugFromPath } from "@/lib/docs";

/**
 * The docs' sidebar, in the interface language: the index and both parts with their pages (the current
 * one marked). Below `sm` the list folds behind a "Contents" button. The header's LocalePicker switches language.
 */
export function DocsNav() {
  const t = useTranslations("Docs");
  const pathname = usePathname();
  const slug = slugFromPath(pathname)?.slug;
  const [open, setOpen] = useState(false);
  // Opening another page folds the list again (the layout, and this state, outlive the navigation):
  // reset while rendering when the pathname changes, as NavMenu does.
  const [shownFor, setShownFor] = useState(pathname);
  if (pathname !== shownFor) {
    setShownFor(pathname);
    setOpen(false);
  }
  const listId = useId();
  const current = (s?: string) => (s === slug ? ("page" as const) : undefined);

  return (
    <nav aria-label={t("index.title")} className="shrink-0 text-sm sm:w-56">
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 sm:hidden dark:border-slate-700"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        {t("contents")}
      </button>
      <div id={listId} className={`${open ? "block" : "hidden"} mt-3 sm:block`}>
        <Link href={docHref()} aria-current={current(undefined)} className="font-semibold aria-[current=page]:text-[#a3161b] dark:aria-[current=page]:text-red-400">
          {t("index.title")}
        </Link>
        {DOC_PARTS.map((part) => (
          <div key={part} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`parts.${part}`)}</p>
            <ul className="mt-1 space-y-1">
              {DOC_PAGES.filter((p) => p.part === part).map((p) => (
                <li key={p.slug}>
                  <Link href={docHref(p.slug)} aria-current={current(p.slug)} className="hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-[#a3161b] dark:aria-[current=page]:text-red-400">
                    {t(`pages.${p.slug}.title`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
