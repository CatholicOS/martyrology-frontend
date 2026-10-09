import { useTranslations } from "next-intl";
import { MentionText } from "@/components/markup/MentionPiece";
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
 * `edition` (a CLBDR edition id) names the edition the persons and places marked in the footnotes are printed in.
 */
export default function PrintedFootnotes({ notes, lang, edition = "" }: { notes: PageFootnote[]; lang?: string; edition?: string }) {
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
            <span>
              <MentionText text={n.text} mentions={n.mentions} where={n.number ?? 0} eulogy={n.id} edition={edition} />
            </span>
            {n.marginalia.length > 0 && <MarginNotes notes={n.marginalia} />}
          </li>
        ))}
      </ul>
    </aside>
  );
}
