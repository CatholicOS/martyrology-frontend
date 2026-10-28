"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { dayPath, todayLocal } from "@/lib/calendar";

/** "Today" depends on the reader's timezone, so it is decided in the browser. `withEdition`: the comparison to open it with. */
export default function TodayRedirect({ edition, withEdition = null }: { edition: string; withEdition?: string | null }) {
  const router = useRouter();
  const t = useTranslations("Home");
  useEffect(() => {
    router.replace(dayPath(edition, todayLocal(), withEdition));
  }, [router, edition, withEdition]);
  return <p className="mt-10 text-center text-slate-500">{t("openingToday")}</p>;
}
