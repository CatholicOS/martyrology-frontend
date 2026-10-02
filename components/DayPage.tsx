import CuratorNotes from "@/components/CuratorNotes";
import Eulogy from "@/components/Eulogy";
import styles from "@/components/page.module.css";
import { pageNotes } from "@/lib/notes";
import type { DayContentOut } from "@/lib/types";

/** Split "… R. Deo gratias." so the response mark can be set as a rubric. */
export function Conclusio({ text }: { text: string }) {
  const at = text.lastIndexOf("R.");
  if (at < 0) return <p className={styles.conclusio}>{text}</p>;
  return (
    <p className={styles.conclusio}>
      {text.slice(0, at)}
      <span className={styles.rubric}>R.</span>
      {text.slice(at + 2)}
    </p>
  );
}

/**
 * One day typeset as a printed page. `heading` is used when the edition prints no titulus;
 * `edition` (a CLBDR edition id) selects the misprint notes; `showIds` sets each eulogy's canonical id above it
 * and the curators' notes at the foot of the page.
 */
export default function DayPage({
  day, heading, lang, edition, showIds = false,
}: { day: DayContentOut; heading: string; lang?: "la" | "it" | "en"; edition?: string; showIds?: boolean }) {
  const notes = showIds ? pageNotes(day.elogia.map((e) => e.id), edition ?? "") : [];
  const noteOf = new Map(notes.map((n) => [n.id, n]));
  return (
    <article className={styles.page} lang={lang}>
      <h2 className={styles.heading}>{day.titulus || heading}</h2>
      {day.elogia.map((e, i) => (
        <Eulogy key={e.id ?? i} e={e} edition={edition} showId={showIds} note={e.id ? noteOf.get(e.id) : undefined} />
      ))}
      {day.conclusio && <Conclusio text={day.conclusio} />}
      <CuratorNotes notes={notes} />
    </article>
  );
}
