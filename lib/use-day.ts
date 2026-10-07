"use client";

import { useEffect, useState } from "react";
import { ApiError, getDay } from "@/lib/api";
import { pad2 } from "@/lib/calendar";
import type { DayOut } from "@/lib/types";

export type DayState =
  | { kind: "loading" }
  | { kind: "ready"; day: DayOut }
  | { kind: "locked"; accessInfo: string | null }
  | { kind: "notext" }
  | { kind: "error" };

/**
 * One edition's day. Callers key their component on edition and day, so each day starts in
 * "loading"; `retry` loads again after an error.
 */
export function useDay(edition: string, mm: number, dd: number): { state: DayState; retry: () => void } {
  const [state, setState] = useState<DayState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The moon is announced for the reader's own year.
    getDay(edition, pad2(mm), pad2(dd), new Date().getFullYear()).then(
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

  return { state, retry };
}
