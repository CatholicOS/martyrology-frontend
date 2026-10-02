import { NoteMark } from "@/components/CuratorNotes";
import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { PageNote } from "@/lib/notes";
import type { ElogiumOut } from "@/lib/types";

/**
 * One eulogy as printed: its number, asterisk and full stop as rubrics ("3*."), or,
 * unnumbered, as a centred heading. `edition` (a CLBDR edition id) selects the misprint notes;
 * `showId` sets the canonical id above it, and `note` marks the curators' note on it, for curators.
 */
export default function Eulogy({
  e, edition, showId = false, note,
}: { e: ElogiumOut; edition?: string; showId?: boolean; note?: PageNote }) {
  const printed = e.text && edition ? <EulogyText text={e.text} id={e.id} edition={edition} noteClassName={styles.sic} /> : e.text;
  const text = note ? <>{printed}<NoteMark note={note} /></> : printed;
  const hint = showId && e.id ? <p className={styles.idHint}>{e.id}</p> : null;
  return e.unnumbered ? (
    <>
      {hint}
      <p className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true" data-eulogy-id={e.id ?? undefined}>
        {text}
      </p>
    </>
  ) : (
    <>
      {hint}
      <p className={styles.entry} data-eulogy-id={e.id ?? undefined}>
        {/* Historical prints (1749, 1914) number no eulogies: the API sends no entry. */}
        {e.entry !== null && (
          <span className={styles.rubric}>
            {e.entry}
            {e.asterisk ? "*" : ""}.
          </span>
        )}
        {text}
      </p>
    </>
  );
}
