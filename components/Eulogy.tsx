import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { ElogiumOut } from "@/lib/types";

/**
 * One eulogy as printed: its number, asterisk and full stop as rubrics ("3*."), or,
 * unnumbered, as a centred heading. `edition` (a CLBDR edition id) selects the misprint notes.
 */
export default function Eulogy({ e, edition }: { e: ElogiumOut; edition?: string }) {
  const text = e.text && edition ? <EulogyText text={e.text} id={e.id} edition={edition} noteClassName={styles.sic} /> : e.text;
  return e.unnumbered ? (
    <p className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true">
      {text}
    </p>
  ) : (
    <p className={styles.entry}>
      <span className={styles.rubric}>
        {e.entry}
        {e.asterisk ? "*" : ""}.
      </span>
      {text}
    </p>
  );
}
