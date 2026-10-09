"use client";

import { useCallback, useSyncExternalStore } from "react";

type Store = { current: boolean | null; listeners: Set<() => void> };
const stores = new Map<string, Store>();
let subscribed = 0;

function store(key: string): Store {
  let s = stores.get(key);
  if (!s) {
    // This tab's choice, so the switch still works where storage is blocked.
    s = { current: null, listeners: new Set() };
    stores.set(key, s);
  }
  return s;
}

function onStorage(e: StorageEvent) {
  const s = e.key ? stores.get(e.key) : undefined;
  if (!s) return;
  s.current = null; // another tab flipped it: read it afresh
  s.listeners.forEach((l) => l());
}

/** Test-only: forgets this tab's choices. */
export function __resetReaderSwitches() {
  for (const s of stores.values()) s.current = null;
}

/** One of the reader's switches, remembered in this browser under `key` across days and visits; off by default. */
export function useReaderSwitch(key: string): [boolean, (on: boolean) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const s = store(key);
      if (subscribed++ === 0) window.addEventListener("storage", onStorage);
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
        if (--subscribed === 0) window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const read = useCallback(() => {
    const s = store(key);
    if (s.current !== null) return s.current;
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false; // storage blocked: the switch starts off
    }
  }, [key]);
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback(
    (next: boolean) => {
      const s = store(key);
      s.current = next;
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // storage blocked: nothing to remember it in
      }
      s.listeners.forEach((l) => l());
    },
    [key],
  );
  return [on, set];
}

/** The reader's "Names & places" switch: marks the persons and places the eulogies name. */
export function useMarkupSwitch(): [boolean, (on: boolean) => void] {
  return useReaderSwitch("reader.markup");
}
