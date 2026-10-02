"use client";

import { signIn } from "next-auth/react";
import LockedNotice from "@/components/LockedNotice";
import { monthName } from "@/lib/calendar";
import type { DayState } from "@/lib/use-day";

/** What stands in for a day's page while it loads, or when it is locked, missing or failed. */
export default function DayStatus({
  state, retry, title, signedIn, mm, dd,
}: {
  state: Exclude<DayState, { kind: "ready" }>;
  retry: () => void;
  title: string;
  signedIn: boolean;
  mm: number;
  dd: number;
}) {
  switch (state.kind) {
    case "loading":
      return (
        <div role="status" className="mx-auto min-h-96 max-w-[38rem] animate-pulse rounded bg-[#fbf6ec]">
          <span className="sr-only">Loading…</span>
        </div>
      );
    case "locked":
      return <LockedNotice title={title} signedIn={signedIn} accessInfo={state.accessInfo} onSignIn={() => void signIn("zitadel")} />;
    case "notext":
      return <p className="mt-10 text-center">This edition has no text for {dd} {monthName(mm, "en")}.</p>;
    case "error":
      return (
        <p className="mt-10 text-center">
          The text could not be loaded.{" "}
          <button type="button" className="underline" onClick={retry}>Retry</button>
        </p>
      );
  }
}
