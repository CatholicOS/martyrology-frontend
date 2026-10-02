import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { DayContentOut } from "@/lib/types";

/** Split "… R. Deo gratias." so the response mark can be set as a rubric. */
function Conclusio({ text }: { text: string }) {
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
 * `edition` (a CLBDR edition id) selects the misprint notes.
 */
export default function DayPage({
  day, heading, lang, edition,
}: { day: DayContentOut; heading: string; lang?: "la" | "it" | "en"; edition?: string }) {
  const text = (e: DayContentOut["elogia"][number]) =>
    e.text && edition ? <EulogyText text={e.text} id={e.id} edition={edition} noteClassName={styles.sic} /> : e.text;
  return (
    <article className={styles.page} lang={lang}>
      <h2 className={styles.heading}>{day.titulus || heading}</h2>
      {day.elogia.map((e, i) =>
        e.unnumbered ? (
          <p key={e.id ?? i} className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true">
            {text(e)}
          </p>
        ) : (
          <p key={e.id ?? i} className={styles.entry}>
            <span className={styles.rubric}>
              {e.entry}
              {e.asterisk ? "*" : ""}
            </span>
            {text(e)}
          </p>
        ),
      )}
      {day.conclusio && <Conclusio text={day.conclusio} />}
    </article>
  );
}
