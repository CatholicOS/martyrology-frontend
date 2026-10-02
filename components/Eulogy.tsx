import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { ElogiumOut } from "@/lib/types";

/**
 * One eulogy as printed: its number, asterisk and full stop as rubrics ("3*."), or,
 * unnumbered, as a centred heading. `edition` (a CLBDR edition id) selects the misprint notes;
 * `showId` sets the canonical id above it, for curators.
 */
export default function Eulogy({ e, edition, showId = false }: { e: ElogiumOut; edition?: string; showId?: boolean }) {
  const text = e.text && edition ? <EulogyText text={e.text} id={e.id} edition={edition} noteClassName={styles.sic} /> : e.text;
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
