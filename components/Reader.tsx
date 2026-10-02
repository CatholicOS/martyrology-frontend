"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DayPage from "@/components/DayPage";
import DayStatus from "@/components/DayStatus";
import ReaderBar from "@/components/ReaderBar";
import styles from "@/components/page.module.css";
import { getAccess, getEditions } from "@/lib/api";
import { dateHeading, dayPath, nextDay, prevDay, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, shelfState, sortForShelf, titleCase } from "@/lib/editions";
import type { AccessMap, EditionOut } from "@/lib/types";
import { useDay } from "@/lib/use-day";

const SWIPE_PX = 50;

// The whole strip beside the page turns it; the arrow is pinned near the top
// (sticky) so it keeps its place whatever the day's length.
const STRIP =
  "group flex w-10 shrink-0 cursor-pointer justify-center rounded sm:w-16 " +
  "hover:bg-[#8b1a1f]/5 focus-visible:bg-[#8b1a1f]/5 dark:hover:bg-red-300/10 dark:focus-visible:bg-red-300/10";
const ARROW =
  "sticky top-20 mt-6 h-fit text-3xl text-[#8b1a1f] opacity-60 group-hover:opacity-100 " +
  "group-focus-visible:opacity-100 dark:text-red-300 dark:opacity-100";

type Turn = "next" | "prev" | null;

// Next remounts the page when the day changes, so the turn direction and the
// edition list must survive the remount. Written only from browser handlers/effects.
let pendingTurn: Turn = null;
let pendingFocus: string | null = null;
let cached: { editions: EditionOut[]; access: AccessMap | null } | null = null;

/** Test-only: clears the module state shared between Reader instances. */
export function __resetReaderState() {
  pendingTurn = null;
  pendingFocus = null;
  cached = null;
}

/** One day's page; keyed by the parent on edition/day so each turn starts fresh in "loading". */
function DayView({
  edition, mm, dd, lang, title, signedIn, turn,
}: {
  edition: string; mm: number; dd: number; lang: Lang; title: string; signedIn: boolean; turn: Turn;
}) {
  const { state, retry } = useDay(edition, mm, dd);
  if (state.kind !== "ready") {
    return <DayStatus state={state} retry={retry} title={title} signedIn={signedIn} mm={mm} dd={dd} />;
  }
  return (
    <div className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
      <DayPage day={state.day} heading={dateHeading({ mm, dd }, lang)} lang={lang} edition={edition} />
    </div>
  );
}

function isFormField(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || ["SELECT", "INPUT", "TEXTAREA"].includes(t.tagName));
}

export default function Reader({ edition, mm, dd, signedIn }: { edition: string; mm: number; dd: number; signedIn: boolean }) {
  const router = useRouter();
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const [editions, setEditions] = useState<EditionOut[]>(() => cached?.editions ?? []);
  const [access, setAccess] = useState<AccessMap | null>(() => cached?.access ?? null);
  const [turn] = useState<Turn>(() => pendingTurn);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const navigated = useRef(false);

  useEffect(() => {
    pendingTurn = null; // consumed by the initialiser above
    // Next remounts the page on a day change, which drops focus to <body>.
    const id = pendingFocus;
    pendingFocus = null;
    if (id) document.getElementById(id)?.focus();
  }, []);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    Promise.all([getEditions(), getAccess().catch(() => null)]).then(
      ([eds, acc]) => {
        if (cancelled) return;
        const sorted = sortForShelf(eds);
        cached = { editions: sorted, access: acc };
        setEditions(sorted);
        setAccess(acc);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const go = useCallback(
    (d: Day, direction: Turn = null, focusId: string | null = null) => {
      if (navigated.current) return;
      if (d.mm === mm && d.dd === dd) return; // same URL: Next would not remount, leaving the guard stuck
      navigated.current = true;
      pendingTurn = direction;
      pendingFocus = focusId;
      router.push(dayPath(edition, d));
    },
    [router, edition, mm, dd],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.repeat || e.defaultPrevented) return;
      if (isFormField(e.target)) return;
      if (e.key === "ArrowRight") go(nextDay(day), "next");
      if (e.key === "ArrowLeft") go(prevDay(day), "prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, go]);

  const current = editions.find((e) => e.edition_id === edition);
  const lang = current ? editionLang(current) : "la";
  const title = current ? `${titleCase(editionTitle(current))} ${current.year}` : edition;
  const books = useMemo(() => {
    const options = editions
      .filter((e) => shelfState(e, access) === "open")
      .map((e) => ({ id: e.edition_id, label: `${titleCase(editionTitle(e))} ${e.year}` }));
    if (options.some((o) => o.id === edition)) return options;
    // The current book is locked, or the list is still loading or failed to load:
    // keep it as the first option so the select always shows what is open.
    return [{ id: edition, label: title }, ...options];
  }, [editions, access, edition, title]);

  return (
    <div>
      <ReaderBar edition={edition} day={day} books={books} onGo={(d, focusId) => go(d, null, focusId)}
        onSwitch={(id, focusId) => {
          if (navigated.current || id === edition) return;
          navigated.current = true;
          pendingTurn = null;
          pendingFocus = focusId;
          router.push(dayPath(id, day));
        }} />
      <div
        className="flex items-stretch gap-2"
        onTouchStart={(e) => {
          touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
          if (dx < 0) go(nextDay(day), "next");
          else go(prevDay(day), "prev");
        }}
      >
        <button type="button" id="reader-prev" aria-label="Previous day" data-strip="true" className={STRIP} onClick={() => go(prevDay(day), "prev", "reader-prev")}>
          <span aria-hidden className={ARROW}>‹</span>
        </button>
        <div className="flex-1">
          {/* key resets DayView's loading state for each day/edition */}
          <DayView
            key={`${edition}/${mm}/${dd}`}
            edition={edition}
            mm={mm}
            dd={dd}
            lang={lang}
            title={title}
            signedIn={signedIn}
            turn={turn}
          />
        </div>
        <button type="button" id="reader-next" aria-label="Next day" data-strip="true" className={STRIP} onClick={() => go(nextDay(day), "next", "reader-next")}>
          <span aria-hidden className={ARROW}>›</span>
        </button>
      </div>
    </div>
  );
}
