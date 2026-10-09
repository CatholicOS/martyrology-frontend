"use client";

import { __resetReaderSwitches, useReaderSwitch } from "@/lib/use-reader-switch";

/** Test-only: forgets this tab's choice. */
export const __resetShowIds = __resetReaderSwitches;

/** The reader's "show canonical ids" switch, remembered in this browser across days and visits. */
export function useShowIds(): [boolean, (on: boolean) => void] {
  return useReaderSwitch("reader.showIds");
}
