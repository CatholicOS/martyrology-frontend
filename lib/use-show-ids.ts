"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "reader.showIds";
const listeners = new Set<() => void>();
// This tab's choice, so the switch still works where storage is blocked.
let current: boolean | null = null;

function read(): boolean {
  if (current !== null) return current;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked: the ids start hidden
  }
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  current = null; // another tab flipped it: read it afresh
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Test-only: forgets this tab's choice. */
export function __resetShowIds() {
  current = null;
}

/** The reader's "show canonical ids" switch, remembered in this browser across days and visits. */
export function useShowIds(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => {
    current = next;
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // storage blocked: nothing to remember it in
    }
    listeners.forEach((l) => l());
  }, []);
  return [on, set];
}
