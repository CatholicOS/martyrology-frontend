import { useTranslations } from "next-intl";
import styles from "@/components/page.module.css";
import type { PageFootnote } from "@/lib/footnotes";

/** Notes the edition prints in the margin, set apart as side-notes. */
export function MarginNotes({ notes }: { notes: string[] }) {
  const t = useTranslations("Reader");
  return (
    <span className={styles.marginNotes} role="note" aria-label={t("inMargin")}>
      {notes.map((t, i) => (
        <span key={i} className={styles.marginNote}>
          {t}
        </span>
      ))}
    </span>
  );
}

/** A printed footnote's mark in the text, as printed and in the text's colour, linked to the footnote. */
export function FootnoteMark({ note }: { note: PageFootnote }) {
  const t = useTranslations("Reader");
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.fnMark} aria-label={t("footnote", { mark: note.mark })}>
      {note.mark}
    </a>
  );
}

/**
 * The edition's own footnotes at the foot of the page, each linked back to its mark, with the notes
 * the edition prints in the margin beside it (beside the note on wide screens, under it on phones).
 */
export default function PrintedFootnotes({ notes, lang }: { notes: PageFootnote[]; lang?: string }) {
  const t = useTranslations("Reader");
  if (notes.length === 0) return null;
  return (
    <aside className={styles.footnotes} lang={lang} aria-label={t("footnotes")}>
      <ul>
        {notes.map((n) => (
          <li key={n.anchor} id={n.anchor} className={n.marginalia.length ? styles.withMargin : undefined}>
            <a href={`#${n.markAnchor}`} className={styles.fnMark} aria-label={t("backToFootnote", { mark: n.mark })}>
              {n.mark}
            </a>
            <span>{n.text}</span>
            {n.marginalia.length > 0 && <MarginNotes notes={n.marginalia} />}
          </li>
        ))}
      </ul>
    </aside>
  );
}
