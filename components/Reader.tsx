"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import DayPage from "@/components/DayPage";
import DayStatus from "@/components/DayStatus";
import ReaderBar from "@/components/ReaderBar";
import Spread from "@/components/Spread";
import styles from "@/components/page.module.css";
import { getAccess, getCatalog, getEditions } from "@/lib/api";
import { dateHeading, dayPath, nextDay, prevDay, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, shelfState, sortForShelf, titleCase } from "@/lib/editions";
import { subjectOptions, type SubjectOption } from "@/lib/subjects";
import type { AccessMap, EditionOut } from "@/lib/types";
import { useDay } from "@/lib/use-day";
import { useShowIds } from "@/lib/use-show-ids";

const SWIPE_PX = 50;

// The whole strip beside the page turns it; the arrow is pinned near the top
// (sticky) so it keeps its place whatever the day's length. On phones the strips take no
// space (swipe turns the page there): visually hidden, they stay for screen readers and
// keyboards, and show while focused.
const STRIP =
  "group flex w-10 shrink-0 cursor-pointer justify-center rounded sm:w-16 " +
  "max-sm:sr-only max-sm:focus-visible:not-sr-only " +
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
// The eulogy a subject search went to, found once its page is drawn.
let pendingTarget: string | null = null;
// Each book's subject-search options, by "edition/locale".
const subjectsCache = new Map<string, SubjectOption[]>();

/** Test-only: clears the module state shared between Reader instances. */
export function __resetReaderState() {
  pendingTurn = null;
  pendingFocus = null;
  pendingTarget = null;
  cached = null;
  subjectsCache.clear();
}

const FOUND_MS = 2400;

/** The eulogy a link names in the address (`#mr:…`), if any. */
function hashId(): string | null {
  if (typeof window === "undefined") return null;
  const id = decodeURIComponent(window.location.hash.slice(1));
  return id.startsWith("mr:") ? id : null;
}

/** Scroll to the eulogy and mark it briefly; false while it is not drawn yet. */
function reveal(root: HTMLElement, id: string): boolean {
  const el = [...root.querySelectorAll<HTMLElement>("[data-eulogy-id]")].find((n) => n.dataset.eulogyId === id);
  if (!el) return false;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView?.({ block: "center", behavior: still ? "auto" : "smooth" });
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
  el.removeAttribute("data-found");
  void el.offsetWidth; // restart the wash when the same eulogy is found again
  el.setAttribute("data-found", "");
  window.setTimeout(() => el.removeAttribute("data-found"), FOUND_MS);
  return true;
}

/** One day's page; keyed by the parent on edition/day so each turn starts fresh in "loading". */
function DayView({
  edition, mm, dd, lang, title, signedIn, turn, showIds,
}: {
  edition: string; mm: number; dd: number; lang: Lang; title: string; signedIn: boolean; turn: Turn; showIds: boolean;
}) {
  const { state, retry } = useDay(edition, mm, dd);
  if (state.kind !== "ready") {
    return <DayStatus state={state} retry={retry} title={title} signedIn={signedIn} mm={mm} dd={dd} />;
  }
  return (
    <div className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
      <DayPage day={state.day} heading={dateHeading({ mm, dd }, lang)} lang={lang} edition={edition} showIds={showIds} />
    </div>
  );
}

function isFormField(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || ["SELECT", "INPUT", "TEXTAREA"].includes(t.tagName));
}

export default function Reader({
  edition, mm, dd, signedIn, withEdition = null,
}: { edition: string; mm: number; dd: number; signedIn: boolean; withEdition?: string | null }) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const [editions, setEditions] = useState<EditionOut[]>(() => cached?.editions ?? []);
  const [access, setAccess] = useState<AccessMap | null>(() => cached?.access ?? null);
  const [turn] = useState<Turn>(() => pendingTurn);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pages = useRef<HTMLDivElement>(null);
  // A fresh object per search, so finding the same eulogy twice scrolls to it again.
  const [target, setTarget] = useState<{ id: string } | null>(() => {
    if (pendingTarget) return { id: pendingTarget };
    const id = hashId();
    return id ? { id } : null;
  });
  const [showIds, setShowIds] = useShowIds();

  const navigated = useRef(false);

  // A link to a eulogy on the open day (a curator's note naming another ID) only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const id = hashId();
      if (id) setTarget({ id });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    pendingTarget = null; // consumed by the initialiser above
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

  // Every navigation goes through here: one push per remount, focus and turn handed to the next page.
  const navigate = useCallback(
    (path: string, direction: Turn = null, focusId: string | null = null) => {
      if (navigated.current) return;
      navigated.current = true;
      pendingTurn = direction;
      pendingFocus = focusId;
      router.push(path);
    },
    [router],
  );

  const go = useCallback(
    (d: Day, direction: Turn = null, focusId: string | null = null) => {
      if (d.mm === mm && d.dd === dd) return; // same URL: Next would not remount, leaving the guard stuck
      navigate(dayPath(edition, d, withEdition), direction, focusId);
    },
    [navigate, edition, withEdition, mm, dd],
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

  // The page may still be loading, or be retried after an error: watch for the eulogy until it is drawn.
  useEffect(() => {
    const root = pages.current;
    if (!target || !root) return;
    if (reveal(root, target.id)) return;
    const watch = new MutationObserver(() => {
      if (reveal(root, target.id)) watch.disconnect();
    });
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [target]);

  const current = editions.find((e) => e.edition_id === edition);
  const lang = current ? editionLang(current) : "la";
  const subjectsKey = current ? `${edition}/${lang}` : null;
  const [subjects, setSubjects] = useState<{ key: string; options: SubjectOption[] } | null>(null);
  const subjectsNow = subjectsKey
    ? (subjectsCache.get(subjectsKey) ?? (subjects?.key === subjectsKey ? subjects.options : null))
    : null;

  useEffect(() => {
    if (!subjectsKey || subjectsCache.has(subjectsKey)) return;
    let cancelled = false;
    getCatalog(edition, lang).then(
      (catalog) => {
        const options = subjectOptions(catalog);
        subjectsCache.set(subjectsKey, options);
        if (!cancelled) setSubjects({ key: subjectsKey, options });
      },
      () => undefined, // no search for this book
    );
    return () => {
      cancelled = true;
    };
  }, [subjectsKey, edition, lang]);

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
  const compareBooks = useMemo(() => {
    const others = books.filter((b) => b.id !== edition);
    if (!withEdition || others.some((b) => b.id === withEdition)) return others;
    // The second book is locked or not listed yet: keep it selectable so the select shows it.
    const meta = editions.find((e) => e.edition_id === withEdition);
    return [...others, { id: withEdition, label: meta ? `${titleCase(editionTitle(meta))} ${meta.year}` : withEdition }];
  }, [books, edition, withEdition, editions]);

  return (
    <div>
      <ReaderBar
        edition={edition}
        day={day}
        books={books}
        onGo={(d, focusId) => go(d, null, focusId)}
        onSwitch={(id, focusId) => {
          if (id === edition) return;
          navigate(dayPath(id, day, id === withEdition ? null : withEdition), null, focusId);
        }}
        compareWith={withEdition}
        compareBooks={compareBooks}
        onCompare={(id, focusId) => {
          if (id === withEdition) return;
          navigate(dayPath(edition, day, id), null, focusId);
        }}
        onSwap={() => {
          if (withEdition) navigate(dayPath(withEdition, day, edition), null, "reader-swap");
        }}
        subjects={subjectsNow}
        onFind={(o) => {
          if (o.day.mm === mm && o.day.dd === dd) setTarget({ id: o.id });
          else {
            pendingTarget = o.id;
            go(o.day);
          }
        }}
        showIds={showIds}
        onShowIds={setShowIds}
      />
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
        <button type="button" id="reader-prev" aria-label={t("prevDay")} data-strip="true" className={STRIP} onClick={() => go(prevDay(day), "prev", "reader-prev")}>
          <span aria-hidden className={ARROW}>‹</span>
        </button>
        <div ref={pages} className="flex-1">
          {withEdition ? (
            /* key resets both sheets' loading state for each pairing/day */
            <Spread
              key={`${edition}+${withEdition}/${mm}/${dd}`}
              a={edition}
              b={withEdition}
              editions={editions}
              mm={mm}
              dd={dd}
              signedIn={signedIn}
              turn={turn}
              showIds={showIds}
            />
          ) : (
            /* key resets DayView's loading state for each day/edition */
            <DayView
              key={`${edition}/${mm}/${dd}`}
              edition={edition}
              mm={mm}
              dd={dd}
              lang={lang}
              title={title}
              signedIn={signedIn}
              turn={turn}
              showIds={showIds}
            />
          )}
        </div>
        <button type="button" id="reader-next" aria-label={t("nextDay")} data-strip="true" className={STRIP} onClick={() => go(nextDay(day), "next", "reader-next")}>
          <span aria-hidden className={ARROW}>›</span>
        </button>
      </div>
    </div>
  );
}
