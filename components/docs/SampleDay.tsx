import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/page.module.css";
import { dateHeading } from "@/lib/calendar";
import { subjectFor } from "@/lib/subjects";

/** The heading the reader shows for 2 January in the 2004 Latin edition ("2 Ianuarii"). */
const TITULUS = dateHeading({ mm: 1, dd: 2 }, "la");

/** 2 January in the editio altera 2004: entry, asterisk, subject (crmedr i18n). No eulogy text. */
const ENTRIES: { entry: number | null; asterisk: boolean; subject: { en: string; it: string } }[] = [
  { entry: null, asterisk: false, subject: { en: "Saints Basil the Great and Gregory Nazianzen", it: "Santi Basilio Magno e Gregorio Nazianzeno" } },
  { entry: 2, asterisk: false, subject: { en: "Saint Telesphorus", it: "San Telesforo" } },
  { entry: 4, asterisk: true, subject: { en: "Saint Theodore", it: "San Teodoro" } },
  { entry: 5, asterisk: true, subject: { en: "Saint Bladulf", it: "San Bladolfo" } },
  { entry: 12, asterisk: true, subject: { en: "Blessed Marcolinus Amanni", it: "Beato Marcolino Amanni" } },
];

/** A schematic day's page for the docs: heading, the unnumbered lead, numbered and asterisked entries. */
export function SampleDay() {
  const locale = useLocale();
  const t = useTranslations("Docs.sampleDay");
  return (
    <figure className="my-6">
      <div className={styles.page} style={{ minHeight: 0 }}>
        <p className={styles.heading} lang="la">{TITULUS}</p>
        {ENTRIES.map((e) => (
          <p key={e.subject.en} className={e.entry === null ? `${styles.entry} ${styles.unnumbered}` : styles.entry}>
            {e.entry !== null && <span className={styles.rubric}>{`${e.entry}${e.asterisk ? "*" : ""}.`}</span>}
            <span>{subjectFor(e.subject, locale)}</span>
            {" …"}
          </p>
        ))}
      </div>
      <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("caption")}</figcaption>
    </figure>
  );
}
