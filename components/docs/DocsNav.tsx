"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useId, useState } from "react";
import { DOC_INDEX, DOC_PAGES, DOC_PARTS, LANG_NAMES, docHref, otherLang, slugFromPath, type DocLang } from "@/lib/docs";

const CONTENTS: Record<DocLang, string> = { en: "Contents", it: "Indice" };

/**
 * The docs' sidebar: the index, both parts with their pages (the current one marked), and the
 * same page in the other language. Below `sm` the list folds behind a "Contents" button.
 */
export function DocsNav({ lang }: { lang: DocLang }) {
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
  const other = otherLang(lang);
  const current = (s?: string) => (s === slug ? ("page" as const) : undefined);

  return (
    <nav aria-label={DOC_INDEX[lang].title} className="shrink-0 text-sm sm:w-56">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 sm:hidden dark:border-slate-700"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {CONTENTS[lang]}
        </button>
        <Link href={docHref(other, slug)} hrefLang={other} lang={other} className="ml-auto underline">
          {LANG_NAMES[other]}
        </Link>
      </div>
      <div id={listId} className={`${open ? "block" : "hidden"} mt-3 sm:block`}>
        <Link href={docHref(lang)} aria-current={current(undefined)} className="font-semibold aria-[current=page]:text-[#a3161b] dark:aria-[current=page]:text-red-400">
          {DOC_INDEX[lang].title}
        </Link>
        {DOC_PARTS.map(({ part, title }) => (
          <div key={part} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title[lang]}</p>
            <ul className="mt-1 space-y-1">
              {DOC_PAGES.filter((p) => p.part === part).map((p) => (
                <li key={p.slug}>
                  <Link href={docHref(lang, p.slug)} aria-current={current(p.slug)} className="hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-[#a3161b] dark:aria-[current=page]:text-red-400">
                    {p.text[lang].title}
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
