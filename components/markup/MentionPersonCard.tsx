"use client";

import { useLocale, useTranslations } from "next-intl";
import { langOn, type Locale } from "@/i18n/routing";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { useEntity } from "@/lib/entities-client";
import { lifeYears } from "@/lib/life-years";
import { inLanguage } from "@/lib/mention-labels";
import type { PlacedMention } from "@/lib/mentions";
import { commonsPage, commonsThumb, wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Commons gives the license link, so it is not trusted: only an http(s) address becomes a link. */
const isWebUrl = (s: string | null): s is string => !!s && /^https?:\/\//i.test(s);

/**
 * A person's popup: their name in the interface language (else English, else the Latin nominative, each tagged),
 * years, description, portrait with its credit, and links to Wikipedia (in the interface language only) and
 * Wikidata. A person not yet linked to Wikidata shows the Latin name, a notice and the eulogy's canonical ID.
 */
export default function MentionPersonCard({ mention, headingId }: { mention: PlacedMention; headingId: string }) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const latin = mention.name ?? mention.form;
  if (!mention.qid) {
    return (
      <>
        <h2 id={headingId} className="font-semibold" lang={langOn("la", locale)}>{latin}</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{t("notLinked")}</p>
        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{mention.eulogy}</p>
      </>
    );
  }
  const person = state.status === "ready" && state.entity?.kind === "person" ? state.entity : null;
  const details = person?.details ?? null;
  const name = inLanguage(person?.labels, locale, latin, "la")!;
  const years = details ? lifeYears(t, locale, details.born, details.died) : null;
  const description = inLanguage(details?.description, locale, null, null);
  const article = details?.wikipedia[locale];
  const image = details?.image ?? null;
  return (
    <>
      <div className="flex gap-3">
        {image && (
          <figure className="w-24 shrink-0">
            <a href={commonsPage(image.file)} {...EXTERNAL}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a remote Commons thumbnail, shown as is */}
              <img src={commonsThumb(image.file, 96)} alt={t("portrait", { name: name.text })} width={96} height={120} className="rounded object-cover" />
            </a>
            <figcaption className="mt-1 text-[0.7rem] leading-tight text-slate-500 dark:text-slate-400">
              {image.author && (
                <>
                  <a href={commonsPage(image.file)} {...EXTERNAL} className="underline">{image.author}</a>
                  {" · "}
                </>
              )}
              {isWebUrl(image.license_url) ? (
                <a href={image.license_url} {...EXTERNAL} className="underline">{image.license}</a>
              ) : (
                image.license
              )}
            </figcaption>
          </figure>
        )}
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold" lang={langOn(name.lang, locale)}>{name.text}</h2>
          {years && <p className="text-slate-600 dark:text-slate-400">{years}</p>}
          {description && <p className="mt-1" lang={langOn(description.lang, locale)}>{description.text}</p>}
          <p className="mt-2 flex gap-3 text-xs">
            {article && (
              <a href={wikipediaUrl(locale, article)} {...EXTERNAL} className="underline">{t("wikipedia")}</a>
            )}
            <a href={wikidataUrl(mention.qid)} {...EXTERNAL} className="underline">{t("wikidata")}</a>
          </p>
        </div>
      </div>
      {(state.status === "loading" || state.status === "idle") && <Loading />}
      {state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}
