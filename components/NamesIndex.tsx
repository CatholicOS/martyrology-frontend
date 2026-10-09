import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LetterBar, LetterPager } from "@/components/LetterNav";
import styles from "@/components/page.module.css";
import { dayPath, interfaceMonth, type Lang } from "@/lib/calendar";
import { fnAnchor, type NamesIndexData } from "@/lib/names-index";

/**
 * An edition's index of names, as a Latin martyrology's Index nominum: the saints and blessed its
 * eulogies name, A–Z by their Latin names, the identified ones with their name in the interface
 * language linked to Wikidata; each mention links to its eulogy, or to the footnote that names it.
 * `index` null: crmedr has no persons for the edition yet (or, with `error`, the catalog failed).
 * `lang`: the edition's language, which its names and subjects are in, inside a page in the interface language.
 */
export default function NamesIndex({ edition, title, index, error = false, letter, lang }: {
  edition: string; title: string; index: NamesIndexData | null; error?: boolean; letter?: string; lang?: Lang;
}) {
  const t = useTranslations("Names");
  const format = useFormatter();
  const locale = useLocale();
  const ed = encodeURIComponent(edition);
  const letters = index?.letters.map((l) => l.letter) ?? [];
  const shown = index?.letters.find((l) => l.letter === letter) ?? index?.letters[0];

  return (
    <article className={styles.page} aria-labelledby="names-title">
      <h1 id="names-title" className={styles.heading}>{t("title", { title })}</h1>
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${ed}`} className="underline">{t("readEdition")}</Link>
        {" · "}
        <Link href={`/read/${ed}/notes`} className="underline">{t("notesLink")}</Link>
        {" · "}
        <Link href={`/read/${ed}/places`} className="underline">{t("placesLink")}</Link>
      </p>
      {error ? (
        <p className="text-center text-red-700">
          {t("loadError")}{" "}
          <Link href={`/read/${ed}/names`} className="underline">{t("retry")}</Link>
        </p>
      ) : !index || !shown ? (
        <p className="text-center text-slate-600">{t("notIndexed")}</p>
      ) : (
        <>
          {index.naming < index.printed && (
            <p className="mb-3 text-center text-sm text-slate-600">{t("coverage", { naming: index.naming, printed: index.printed })}</p>
          )}
          <LetterBar letters={letters} current={shown.letter} base={`/read/${ed}/names`} label={t("letters")} />
          <section aria-labelledby="letter-h">
            <h2 id="letter-h" className={`${styles.heading} mt-6`}>{shown.letter}</h2>
            {shown.persons.map((p) => (
              <div key={p.key} className="mb-4">
                <h3 className="font-semibold">
                  <span lang={lang}>{p.name}</span>
                  {p.qid && (
                    <>
                      {" "}
                      <a href={`https://www.wikidata.org/wiki/${p.qid}`} className="font-normal text-slate-600 underline" target="_blank" rel="noreferrer"
                        lang={p.labelLang && p.labelLang !== locale ? p.labelLang : undefined}>
                        {`${p.label ?? t("wikidata")} ↗`}
                      </a>
                    </>
                  )}
                </h3>
                <ul className="ml-4 text-sm">
                  {p.lines.map((line) => {
                    const day = `${line.day.dd} ${interfaceMonth(format, line.day.mm)}`;
                    const hash = line.footnote ? fnAnchor(edition, line.id, line.footnote) : line.id;
                    return (
                      <li key={`${line.id}-${line.footnote ?? 0}`}>
                        {/* A plain link, with the locale: the page has thousands, and a client Link each
                            would weigh the page down (it opens the day with a page load). */}
                        <a href={`/${locale}${dayPath(edition, line.day)}#${hash}`} aria-label={`${day} · ${line.subject}`} className="underline">
                          {day}
                        </a>
                        {" · "}
                        <span lang={lang}>{line.subject}</span>
                        {line.footnote && <span className="text-slate-600"> · {t("inFootnote", { n: line.footnote })}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
          <LetterPager letters={letters} current={shown.letter} base={`/read/${ed}/names`} />
        </>
      )}
    </article>
  );
}
