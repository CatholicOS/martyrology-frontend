import styles from "@/components/page.module.css";
import type { PageFootnote } from "@/lib/footnotes";

/** Notes the edition prints in the margin, set apart as side-notes. */
export function MarginNotes({ notes }: { notes: string[] }) {
  return (
    <span className={styles.marginNotes} role="note" aria-label="In the margin">
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
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.fnMark} aria-label={`Footnote ${note.mark}`}>
      {note.mark}
    </a>
  );
}

/**
 * The edition's own footnotes at the foot of the page, each linked back to its mark, with the notes
 * the edition prints in the margin beside it (beside the note on wide screens, under it on phones).
 */
export default function PrintedFootnotes({ notes, lang }: { notes: PageFootnote[]; lang?: string }) {
  if (notes.length === 0) return null;
  return (
    <aside className={styles.footnotes} lang={lang} aria-label="Footnotes">
      <ul>
        {notes.map((n) => (
          <li key={n.anchor} id={n.anchor} className={n.marginalia.length ? styles.withMargin : undefined}>
            <a href={`#${n.markAnchor}`} className={styles.fnMark} aria-label={`Back to the text of footnote ${n.mark}`}>
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
