import { useTranslations } from "next-intl";
import styles from "@/components/page.module.css";
import NoteText from "@/components/NoteText";
import type { PageNote } from "@/lib/notes";

/** A note's mark in the text: red daggers, linked to the note at the foot of the page. */
export function NoteMark({ note }: { note: PageNote }) {
  const t = useTranslations("Reader");
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.noteMark} aria-label={t("editorialNote", { n: note.mark.length })}>
      {note.mark}
    </a>
  );
}

/** The curators' notes at the foot of a page, each linked back to its mark; the IDs a note names link to their eulogies. */
export default function CuratorNotes({ notes, edition }: { notes: PageNote[]; edition: string }) {
  const t = useTranslations("Reader");
  if (notes.length === 0) return null;
  return (
    <aside className={styles.notes} lang="en" aria-label={t("editorialNotes")}>
      <ul>
        {notes.map((n) => (
          <li key={n.id} id={n.anchor}>
            <a href={`#${n.markAnchor}`} className={styles.noteMark} aria-label={t("backToNote", { n: n.mark.length })}>
              {n.mark}
            </a>
            <span>
              <NoteText note={n.note} edition={edition} />
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
