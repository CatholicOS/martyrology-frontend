"use client";

import { lazy, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { langOn, type Locale } from "@/i18n/routing";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { useEntity } from "@/lib/entities-client";
import type { PlacedMention } from "@/lib/mentions";
import { placeLabel, placeLabelLang } from "@/lib/places-index";
import { regionName } from "@/lib/regions";
import { wikidataUrl } from "@/lib/wikimedia";

// Leaflet comes with the first place popup, not with the reader.
const MentionMap = lazy(() => import("@/components/markup/MentionMap"));

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * A place's popup: its name in the interface language (else English, tagged) and country, the words the edition
 * prints (tagged with the edition's language `lang`), a small map, and links to the map page and Wikidata.
 */
export default function MentionPlaceCard({ mention, edition, lang, headingId }: {
  mention: PlacedMention; edition: string; lang: string | undefined; headingId: string;
}) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const place = state.status === "ready" && state.entity?.kind === "place" ? state.entity : null;
  const name = place && mention.qid ? placeLabel(place, mention.qid, locale) : mention.form;
  const nameLang = place ? placeLabelLang(place, locale) : lang ?? null;
  const country = place ? regionName(locale, place.country) : undefined;
  return (
    <>
      <h2 id={headingId} className="font-semibold">
        <span lang={langOn(nameLang, locale)}>{name}</span>
        {country && <span className="font-normal text-slate-600 dark:text-slate-400"> ({country})</span>}
      </h2>
      {place && <p className="mt-1 italic" lang={langOn(lang, locale)}>{mention.form}</p>}
      {place?.coords && (
        <Suspense fallback={<div className="mt-2 h-40 w-full rounded bg-slate-100 dark:bg-slate-800" />}>
          <MentionMap coords={place.coords} label={t("mapLabel", { name })} />
        </Suspense>
      )}
      <p className="mt-2 flex gap-3 text-xs">
        <Link href={`/map?edition=${encodeURIComponent(edition)}`} className="underline">{t("seeOnMap")}</Link>
        {mention.qid && <a href={wikidataUrl(mention.qid)} {...EXTERNAL} className="underline">{t("wikidata")}</a>}
      </p>
      {mention.qid && (state.status === "loading" || state.status === "idle") && <Loading />}
      {mention.qid && state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}
