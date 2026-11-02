"use client";

import { useLocale, useTranslations } from "next-intl";
import { langOn, type Locale } from "@/i18n/routing";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { useEntity } from "@/lib/entities-client";
import { formatWikidataDate } from "@/lib/life-years";
import { inLanguage } from "@/lib/mention-labels";
import type { PlacedMention } from "@/lib/mentions";
import { wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * An event's popup (a council or synod): its name in the interface language (else Latin, else English, each
 * tagged), the words the edition prints (tagged with the edition's language `lang`), its years and the place it
 * was held, its description, and links to Wikipedia (in the interface language only) and Wikidata.
 */
export default function MentionEventCard({ mention, lang, headingId }: {
  mention: PlacedMention; lang: string | undefined; headingId: string;
}) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const event = state.status === "ready" && state.entity?.kind === "event" ? state.entity : null;
  const own = event?.labels[locale];
  const name = own
    ? { text: own, lang: locale }
    : event?.labels.la
      ? { text: event.labels.la, lang: "la" }
      : inLanguage(event?.labels, locale, mention.form, lang ?? null)!;
  const start = event?.start ? formatWikidataDate(t, locale, event.start) : null;
  const end = event?.end ? formatWikidataDate(t, locale, event.end) : null;
  const when = start && end && start !== end ? t("eventYears", { start, end }) : start ?? end;
  const held = event?.place ? inLanguage(event.place.labels, locale, event.place.label, null) : null;
  const description = inLanguage(event?.description, locale, null, null);
  const article = event?.wikipedia[locale];
  return (
    <>
      <h2 id={headingId} className="font-semibold" lang={langOn(name.lang, locale)}>{name.text}</h2>
      {event && <p className="mt-1 italic" lang={langOn(lang, locale)}>{mention.form}</p>}
      {(when || held) && (
        <p className="text-slate-600 dark:text-slate-400">
          {when}
          {when && held && " · "}
          {held && <span lang={langOn(held.lang, locale)}>{held.text}</span>}
        </p>
      )}
      {description && <p className="mt-1" lang={langOn(description.lang, locale)}>{description.text}</p>}
      <p className="mt-2 flex gap-3 text-xs">
        {article && <a href={wikipediaUrl(locale, article)} {...EXTERNAL} className="underline">{t("wikipedia")}</a>}
        {mention.qid && <a href={wikidataUrl(mention.qid)} {...EXTERNAL} className="underline">{t("wikidata")}</a>}
      </p>
      {mention.qid && (state.status === "loading" || state.status === "idle") && <Loading />}
      {mention.qid && state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}
