import styles from "@/components/page.module.css";
import { dateHeading } from "@/lib/calendar";
import type { DocLang } from "@/lib/docs";

/** The heading the reader shows for 2 January in the 2004 Latin edition ("2 Ianuarii"). */
const TITULUS = dateHeading({ mm: 1, dd: 2 }, "la");

/** 2 January in the editio altera 2004: entry, asterisk, subject (crmedr i18n). No eulogy text. */
const ENTRIES: { entry: number | null; asterisk: boolean; en: string; it: string }[] = [
  { entry: null, asterisk: false, en: "Saints Basil the Great and Gregory Nazianzen", it: "Santi Basilio Magno e Gregorio Nazianzeno" },
  { entry: 2, asterisk: false, en: "Saint Telesphorus", it: "San Telesforo" },
  { entry: 4, asterisk: true, en: "Saint Theodore", it: "San Teodoro" },
  { entry: 5, asterisk: true, en: "Saint Bladulf", it: "San Bladolfo" },
  { entry: 12, asterisk: true, en: "Blessed Marcolinus Amanni", it: "Beato Marcolino Amanni" },
];

const CAPTION: Record<DocLang, string> = {
  en: "2 January in the 2004 Latin edition, in outline: each eulogy is shown by its subject only. Entries 3, 6–11 and 13–15 are left out.",
  it: "Il 2 gennaio nell’edizione latina del 2004, in schema: ogni elogio è indicato solo dal suo soggetto. Sono omessi gli elogi 3, 6–11 e 13–15.",
};

/** A schematic day's page for the docs: heading, the unnumbered lead, numbered and asterisked entries. */
export function SampleDay({ lang }: { lang: DocLang }) {
  return (
    <figure className="my-6">
      <div className={styles.page} style={{ minHeight: 0 }}>
        <p className={styles.heading} lang="la">{TITULUS}</p>
        {ENTRIES.map((e) => (
          <p key={e.en} className={e.entry === null ? `${styles.entry} ${styles.unnumbered}` : styles.entry}>
            {e.entry !== null && <span className={styles.rubric}>{`${e.entry}${e.asterisk ? "*" : ""}.`}</span>}
            <span>{e[lang]}</span>
            {" …"}
          </p>
        ))}
      </div>
      <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">{CAPTION[lang]}</figcaption>
    </figure>
  );
}
