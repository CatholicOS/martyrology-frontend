"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import DayPage from "@/components/DayPage";
import LockedNotice from "@/components/LockedNotice";
import ReaderBar from "@/components/ReaderBar";
import styles from "@/components/page.module.css";
import { ApiError, getAccess, getDay, getEditions } from "@/lib/api";
import { dateHeading, dayPath, monthName, nextDay, pad2, prevDay, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, shelfState, sortForShelf, titleCase } from "@/lib/editions";
import type { AccessMap, DayOut, EditionOut } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; day: DayOut }
  | { kind: "locked"; accessInfo: string | null }
  | { kind: "notext" }
  | { kind: "error" };

const SWIPE_PX = 50;

type Turn = "next" | "prev" | null;

// Next remounts the page when the day changes, so the turn direction and the
// edition list must survive the remount. Written only from browser handlers/effects.
let pendingTurn: Turn = null;
let cached: { editions: EditionOut[]; access: AccessMap | null } | null = null;

/** Test-only: clears the module state shared between Reader instances. */
export function __resetReaderState() {
  pendingTurn = null;
  cached = null;
}

/** One day's page; keyed by the parent on edition/day so each turn starts fresh in "loading". */
function DayView({
  edition, mm, dd, lang, title, signedIn, turn,
}: {
  edition: string; mm: number; dd: number; lang: Lang; title: string; signedIn: boolean; turn: Turn;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDay(edition, pad2(mm), pad2(dd)).then(
      (data) => {
        if (cancelled) return;
        if (data.metadata.access === "restricted-texts") {
          setState({ kind: "locked", accessInfo: data.metadata.access_info ?? null });
        } else {
          setState({ kind: "ready", day: data });
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        setState(err instanceof ApiError && err.status === 404 ? { kind: "notext" } : { kind: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [edition, mm, dd, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <>
      {state.kind === "loading" && <div className="mx-auto min-h-96 max-w-[38rem] animate-pulse rounded bg-[#fbf6ec]" aria-label="Loading" />}
      {state.kind === "ready" && (
        <div className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
          <DayPage day={state.day} heading={dateHeading({ mm, dd }, lang)} />
        </div>
      )}
      {state.kind === "locked" && (
        <LockedNotice title={title} signedIn={signedIn} accessInfo={state.accessInfo} onSignIn={() => void signIn("zitadel")} />
      )}
      {state.kind === "notext" && (
        <p className="mt-10 text-center">This edition has no text for {dd} {monthName(mm, "en")}.</p>
      )}
      {state.kind === "error" && (
        <p className="mt-10 text-center">
          The text could not be loaded.{" "}
          <button type="button" className="underline" onClick={retry}>Retry</button>
        </p>
      )}
    </>
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

  useEffect(() => {
    pendingTurn = null; // consumed by the initialiser above
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
    (d: Day, direction: Turn = null) => {
      pendingTurn = direction;
      router.push(dayPath(edition, d));
    },
    [router, edition],
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
    const openable = editions.filter((e) => shelfState(e, access) === "open");
    const list = openable.some((e) => e.edition_id === edition) || !current ? openable : [current, ...openable];
    return list.map((e) => ({ id: e.edition_id, label: `${titleCase(editionTitle(e))} ${e.year}` }));
  }, [editions, access, edition, current]);

  return (
    <div>
      <ReaderBar edition={edition} day={day} books={books} onGo={(d) => go(d)} onSwitch={(id) => router.push(dayPath(id, day))} />
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
        <button type="button" aria-label="Previous day" className="px-2 text-3xl text-[#8b1a1f] opacity-60 hover:opacity-100" onClick={() => go(prevDay(day), "prev")}>‹</button>
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
        <button type="button" aria-label="Next day" className="px-2 text-3xl text-[#8b1a1f] opacity-60 hover:opacity-100" onClick={() => go(nextDay(day), "next")}>›</button>
      </div>
    </div>
  );
}
