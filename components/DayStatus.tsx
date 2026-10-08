"use client";

import { signIn } from "next-auth/react";
import { useFormatter, useTranslations } from "next-intl";
import LockedNotice from "@/components/LockedNotice";
import { interfaceMonth } from "@/lib/calendar";
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
  const t = useTranslations("Reader");
  const format = useFormatter();
  switch (state.kind) {
    case "loading":
      return (
        <div role="status" className="mx-auto min-h-96 max-w-[38rem] animate-pulse rounded bg-[#fbf6ec]">
          <span className="sr-only">{t("loading")}</span>
        </div>
      );
    case "locked":
      return <LockedNotice title={title} signedIn={signedIn} accessInfo={state.accessInfo} onSignIn={() => void signIn("zitadel")} />;
    case "notext":
      return <p className="mt-10 text-center">{t("noText", { day: dd, month: interfaceMonth(format, mm) })}</p>;
    case "error":
      return (
        <p className="mt-10 text-center">
          {t("loadError")}{" "}
          <button type="button" className="underline" onClick={retry}>{t("retry")}</button>
        </p>
      );
  }
}
