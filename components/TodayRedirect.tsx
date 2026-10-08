"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { dayPath, todayLocal } from "@/lib/calendar";

/** "Today" depends on the reader's timezone, so it is decided in the browser. */
export default function TodayRedirect({ edition }: { edition: string }) {
  const router = useRouter();
  const t = useTranslations("Home");
  useEffect(() => {
    router.replace(dayPath(edition, todayLocal()));
  }, [router, edition]);
  return <p className="mt-10 text-center text-slate-500">{t("openingToday")}</p>;
}
