"use client";

import { useCallback, useEffect, useId, useLayoutEffect, type RefObject } from "react";
import type { OpenPopup, ReaderPage } from "@/components/markup/Markup";
import MentionPersonCard from "@/components/markup/MentionPersonCard";
import MentionPlaceCard from "@/components/markup/MentionPlaceCard";
import { personsOf } from "@/lib/mentions";
import { popupPosition } from "@/lib/popup-position";

/**
 * The open mention's popup: a non-modal dialog beside its mention, below it unless it fits only above, kept in
 * the window as the page scrolls or resizes. Focus moves into it only when the keyboard opened it.
 */
export default function MentionPopup({ ref, open, lang, page, onEnter, onLeave }: {
  ref: RefObject<HTMLDivElement | null>; open: OpenPopup; lang: string | undefined; page: ReaderPage;
  onEnter: () => void; onLeave: () => void;
}) {
  const headingId = useId();
  // Written straight to the element (hidden until then), so following a scroll costs no render.
  const place = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const { top, left } = popupPosition(
      open.anchor.getBoundingClientRect(),
      { width: node.offsetWidth, height: node.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    Object.assign(node.style, { top: `${top}px`, left: `${left}px`, visibility: "visible" });
  }, [ref, open.anchor]);

  useLayoutEffect(place, [place, open.target.mention.key]);
  useEffect(() => {
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    // The details arrive after it opens: follow its height (where the browser can tell).
    const ro = typeof ResizeObserver === "undefined" || !ref.current ? null : new ResizeObserver(place);
    if (ro && ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      ro?.disconnect();
    };
  }, [place, ref]);
  useEffect(() => {
    if (open.keyboard) ref.current?.focus();
  }, [open, ref]);

  const m = open.target.mention;
  // A word that names several persons shows one card each, side by side where there is room.
  const persons = m.kind === "person" ? personsOf(m) : [];
  const ids = persons.length > 1 ? persons.map((_, i) => `${headingId}-${i}`) : [headingId];
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={ids.join(" ")}
      tabIndex={-1}
      className={
        `fixed z-50 ${persons.length > 1 ? "w-[36rem]" : "w-72"} max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded border border-slate-300 bg-white p-3 text-sm text-slate-900 ` +
        "shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 " +
        (open.keyboard ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600" : "outline-none")
      }
      style={{ top: 0, left: 0, visibility: "hidden" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {persons.length > 1 ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-700">
          {persons.map((p, i) => (
            <div key={p.group} className={i > 0 ? "border-t border-slate-200 pt-3 sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-slate-700" : ""}>
              <MentionPersonCard mention={p} page={page} headingId={ids[i]} nth={p.n ?? 1} />
            </div>
          ))}
        </div>
      ) : m.kind === "person" ? (
        <MentionPersonCard mention={m} page={page} headingId={headingId} />
      ) : (
        <MentionPlaceCard mention={m} edition={open.target.edition} lang={lang} headingId={headingId} />
      )}
    </div>
  );
}
