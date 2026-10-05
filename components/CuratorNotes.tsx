import styles from "@/components/page.module.css";
import { noteParts } from "@/lib/note-links";
import type { PageNote } from "@/lib/notes";

/** A note's mark in the text: red daggers, linked to the note at the foot of the page. */
export function NoteMark({ note }: { note: PageNote }) {
  return (
    <a id={note.markAnchor} href={`#${note.anchor}`} className={styles.noteMark} aria-label={`Editorial note ${note.mark.length}`}>
      {note.mark}
    </a>
  );
}

/** The curators' notes at the foot of a page, each linked back to its mark; the IDs a note names link to their eulogies. */
export default function CuratorNotes({ notes, edition }: { notes: PageNote[]; edition: string }) {
  if (notes.length === 0) return null;
  return (
    <aside className={styles.notes} lang="en" aria-label="Editorial notes">
      <ul>
        {notes.map((n) => (
          <li key={n.id} id={n.anchor}>
            <a href={`#${n.markAnchor}`} className={styles.noteMark} aria-label={`Back to the text of note ${n.mark.length}`}>
              {n.mark}
            </a>
            <span>
              {noteParts(n.note, edition).map((p, i) =>
                p.href ? (
                  <a key={i} href={p.href} className="underline">
                    {p.text}
                  </a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
