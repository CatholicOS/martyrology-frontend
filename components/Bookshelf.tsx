"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import BookCover from "@/components/BookCover";
import LockedNotice from "@/components/LockedNotice";
import { getAccess, getEditions } from "@/lib/api";
import { editionTitle, shelfState, sortForShelf, titleCase } from "@/lib/editions";
import type { AccessMap, EditionOut } from "@/lib/types";

const OPEN_MS = 450;

export default function Bookshelf({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const t = useTranslations("Bookshelf");
  const [editions, setEditions] = useState<EditionOut[] | null>(null);
  const [access, setAccess] = useState<AccessMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState<EditionOut | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const swing = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (swing.current !== null) window.clearTimeout(swing.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getEditions(), getAccess().catch(() => null)]).then(
      ([eds, acc]) => {
        if (cancelled) return;
        setEditions(sortForShelf(eds));
        setAccess(acc);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const open = (e: EditionOut) => {
    if (opening !== null) return;
    const path = `/read/${encodeURIComponent(e.edition_id)}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(path);
      return;
    }
    setOpening(e.edition_id);
    swing.current = window.setTimeout(() => router.push(path), OPEN_MS);
  };

  if (failed) {
    return (
      <p className="mt-10 text-center">
        {t("loadFailed")}{" "}
        <button type="button" className="underline" onClick={retry}>
          {t("retry")}
        </button>
      </p>
    );
  }

  return (
    <section aria-label={t("shelfLabel")}>
      <div className="flex flex-wrap items-end justify-center gap-6 border-b-[10px] border-[#6b4a2e] px-4 pb-4 pt-8">
        {editions === null
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[14.5rem] w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" aria-hidden />
            ))
          : editions.map((e) => {
              const state = shelfState(e, access);
              return (
                <BookCover
                  key={e.edition_id}
                  edition={e}
                  state={state}
                  opening={opening === e.edition_id}
                  onClick={state === "open" ? () => open(e) : state === "locked" ? () => setLocked(e) : undefined}
                />
              );
            })}
      </div>
      {locked && (
        <LockedNotice
          title={t("editionName", { title: titleCase(editionTitle(locked)), year: String(locked.year) })}
          signedIn={signedIn}
          accessInfo={locked.availability.note}
          onSignIn={() => void signIn("zitadel")}
          onClose={() => setLocked(null)}
        />
      )}
    </section>
  );
}
