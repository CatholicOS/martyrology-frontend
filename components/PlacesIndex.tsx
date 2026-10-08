import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/page.module.css";
import { dayPath, interfaceMonth } from "@/lib/calendar";
import type { PlacesIndexData } from "@/lib/places-index";

/**
 * An edition's index of places, as at the back of a printed book: the places A–Z in the interface
 * language, under each the eulogies that name it with their day (linked to the eulogy in the reader),
 * subject, the place as the edition prints it, and their typology unless it is the dies natalis.
 * `index` null: the catalog could not be loaded.
 */
export default function PlacesIndex({ edition, title, index }: { edition: string; title: string; index: PlacesIndexData | null }) {
  const t = useTranslations("Places");
  const tMap = useTranslations("Map");
  const format = useFormatter();
  const locale = useLocale();
  const ed = encodeURIComponent(edition);
  const countries = new Intl.DisplayNames([locale], { type: "region" });
  const country = (code: string) => {
    try {
      return code ? countries.of(code) : undefined;
    } catch {
      return undefined; // not a region code
    }
  };

  return (
    <article className={styles.page} aria-labelledby="places-title">
      <h1 id="places-title" className={styles.heading}>
        {t("title", { title })}
      </h1>
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${ed}`} className="underline">{t("readEdition")}</Link>
        {" · "}
        <Link href={`/read/${ed}/notes`} className="underline">{t("notesLink")}</Link>
      </p>
      {!index ? (
        <p className="text-center text-red-700">
          {t("loadError")}{" "}
          <Link href={`/read/${ed}/places`} className="underline">{t("retry")}</Link>
        </p>
      ) : index.placed === 0 ? (
        <p className="text-center text-slate-600">{t("empty")}</p>
      ) : (
        <>
          {index.placed < index.printed && (
            <p className="mb-3 text-center text-sm text-slate-600">{t("coverage", { placed: index.placed, printed: index.printed })}</p>
          )}
          <nav aria-label={t("letters")} className="mb-4 flex flex-wrap justify-center gap-x-2 gap-y-1">
            {index.letters.map((l) => (
              <a key={l.letter} href={`#letter-${l.letter}`} className="underline">{l.letter}</a>
            ))}
          </nav>
          {index.letters.map((l) => (
            <section key={l.letter} id={`letter-${l.letter}`} aria-labelledby={`letter-${l.letter}-h`}>
              <h2 id={`letter-${l.letter}-h`} className={`${styles.heading} mt-6`}>{l.letter}</h2>
              {l.places.map((p) => {
                const c = country(p.country);
                return (
                  <div key={p.qid} className="mb-4">
                    <h3 className="font-semibold">
                      {p.label}
                      {c && <span className="font-normal text-slate-600"> ({c})</span>}
                    </h3>
                    <ul className="ml-4 text-sm">
                      {p.lines.map((line) => {
                        const day = `${line.day.dd} ${interfaceMonth(format, line.day.mm)}`;
                        return (
                          <li key={line.id}>
                            {/* Named with its eulogy too: the page has thousands of day links. */}
                            <Link href={`${dayPath(edition, line.day)}#${line.id}`} aria-label={`${day} · ${line.subject}`} className="underline">
                              {day}
                            </Link>
                            {" · "}
                            {line.subject}
                            {line.printed && <>{" · "}<i>{line.printed}</i></>}
                            {line.typology && line.typology !== "dies_natalis" && tMap.has(`typology.${line.typology}` as "typology.none") && (
                              <span className="text-slate-600"> · {tMap(`typology.${line.typology}` as "typology.none")}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </article>
  );
}
