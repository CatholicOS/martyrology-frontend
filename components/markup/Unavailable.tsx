"use client";

import { useTranslations } from "next-intl";
import { requestEntities } from "@/lib/entities-client";

/** The popup's note when its details could not be loaded, with a way to ask again. */
export function Unavailable({ qid }: { qid: string }) {
  const t = useTranslations("Markup");
  return (
    <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-400">
      {t("unavailable")}{" "}
      <button type="button" className="underline" onClick={() => void requestEntities([qid])}>
        {t("retry")}
      </button>
    </p>
  );
}

/** The popup's note while its details are on their way. */
export function Loading() {
  const t = useTranslations("Markup");
  return <p role="status" className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{t("loading")}</p>;
}
