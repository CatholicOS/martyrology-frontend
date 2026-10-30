"use client";

import { useId } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { langOn, type Locale } from "@/i18n/routing";
import type { ReaderPage } from "@/components/markup/Markup";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { dayPath, interfaceMonth } from "@/lib/calendar";
import { useEntity } from "@/lib/entities-client";
import type { EulogyLink } from "@/lib/entities";
import { lifeYears } from "@/lib/life-years";
import { inLanguage } from "@/lib/mention-labels";
import type { PlacedMention } from "@/lib/mentions";
import { subjectFor } from "@/lib/subjects";
import { usePlacements } from "@/lib/use-placements";
import { commonsPage, commonsThumb, wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Commons gives the license link, so it is not trusted: only an http(s) address becomes a link. */
const isWebUrl = (s: string | null): s is string => !!s && /^https?:\/\//i.test(s);

/**
 * A person's popup: their name in the interface language (else English, else the Latin nominative, each tagged),
 * years, description, portrait with its credit, and links to Wikipedia (in the interface language only) and
 * Wikidata, then the other eulogies that name the same item (their own first), opened in the reader's `page`. A
 * person not yet linked to Wikidata shows the Latin name, a notice and the eulogy's canonical ID.
 */
export default function MentionPersonCard({ mention, page, headingId, nth }: {
  mention: PlacedMention; page: ReaderPage; headingId: string;
  /** Which person of the name this is, shown on a card not linked yet: one of several a word names. */
  nth?: number;
}) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const latin = mention.name ?? mention.form;
  if (!mention.qid) {
    return (
      <>
        <h2 id={headingId} className="font-semibold" lang={langOn("la", locale)}>{latin}</h2>
        {nth && <p className="text-xs text-slate-600 dark:text-slate-400">{t("ordinal", { n: nth })}</p>}
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
  const others = person?.eulogies.filter((e) => e.id !== mention.eulogy) ?? [];
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
      {others.length > 0 && <OtherEulogies eulogies={others} page={page} />}
      {(state.status === "loading" || state.status === "idle") && <Loading />}
      {state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}

/**
 * The other eulogies that name the person: each day, a plain link with the locale, and its subject. A eulogy opens
 * on the day the page's edition prints it, else its comparison, at the ID that edition prints it under, or at the
 * footnote that names the person when the text does not and that edition prints it; one neither prints, or whose
 * placements are not known yet, is left out.
 */
function OtherEulogies({ eulogies, page }: { eulogies: EulogyLink[]; page: ReaderPage }) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const listId = useId();
  const placements = usePlacements(eulogies.map((e) => e.id));
  const printed = eulogies.flatMap((e) => {
    const edition = placements[e.id]?.[page.edition] ? page.edition : page.with;
    const p = edition ? placements[e.id]?.[edition] : undefined;
    const m = /^(\d{2})-(\d{2})$/.exec(p?.day_printed ?? "");
    if (!m || !edition || !p) return [];
    const id = p.printedAs ?? e.id;
    // A person only a footnote names opens at that footnote, where the edition prints it (pageFootnotes' anchor).
    const note = e.footnote && (p.footnotes?.length ?? 0) >= e.footnote ? e.footnote : null;
    return [{ ...e, month: Number(m[1]), day: Number(m[2]), anchor: note ? `fn-${edition}-${id}-${note}` : id }];
  });
  if (printed.length === 0) return null;
  return (
    <div className="mt-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
      <p id={listId} className="text-slate-600 dark:text-slate-400">{t("otherEulogies")}</p>
      <ul aria-labelledby={listId}>
        {printed.map((e) => {
          const subject = subjectFor(e.subject, locale, e.id);
          // subjectFor's own order: the interface language, else English, else Latin.
          const lang = [locale, "en", "la"].find((l) => e.subject[l as keyof EulogyLink["subject"]]?.trim() === subject);
          return (
            <li key={e.id}>
              <a href={`/${locale}${dayPath(page.edition, { mm: e.month, dd: e.day }, page.with)}#${e.anchor}`} className="underline">
                {`${e.day} ${interfaceMonth(format, e.month)}`}
              </a>
              {" · "}
              <span lang={langOn(lang, locale)}>{subject}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
