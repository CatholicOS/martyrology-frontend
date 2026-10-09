import { NoteMark } from "@/components/CuratorNotes";
import { MarginNotes } from "@/components/PrintedFootnotes";
import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { PageFootnote } from "@/lib/footnotes";
import type { PageNote } from "@/lib/notes";
import type { ElogiumOut } from "@/lib/types";

/**
 * One eulogy as printed: its number, asterisk and full stop as rubrics ("3*."), or,
 * unnumbered, as a centred heading. `edition` (a CLBDR edition id) selects the misprint notes;
 * `showId` sets the canonical id above it, and `note` marks the curators' note on it, for curators;
 * `footnotes` are the edition's own footnotes on it, marked in the text; the notes the edition prints
 * in the margin beside the eulogy (not beside one of its footnotes) are set at its side.
 */
export default function Eulogy({
  e, edition, showId = false, note, footnotes,
}: { e: ElogiumOut; edition?: string; showId?: boolean; note?: PageNote; footnotes?: PageFootnote[] }) {
  // Without an edition no misprint matches, so such a page renders as before.
  const printed = e.text || footnotes?.length ? (
    <EulogyText
      text={e.text ?? ""} id={e.id} edition={edition ?? ""} noteClassName={styles.sic} footnotes={footnotes}
      errata={e.errata} errataClassName={styles.errata} mentions={e.mentions}
    />
  ) : (
    e.text
  );
  const beside = (e.marginalia ?? []).filter((m) => m.note === null).map((m) => m.text);
  const side = beside.length > 0 ? <MarginNotes notes={beside} /> : null;
  const text = note ? <>{side}{printed}<NoteMark note={note} /></> : <>{side}{printed}</>;
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
