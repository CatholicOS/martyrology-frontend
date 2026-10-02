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

/** One day typeset as a printed page. `heading` is used when the edition prints no titulus. */
export default function DayPage({ day, heading, lang }: { day: DayContentOut; heading: string; lang?: "la" | "it" | "en" }) {
  return (
    <article className={styles.page} lang={lang}>
      <h2 className={styles.heading}>{day.titulus || heading}</h2>
      {day.elogia.map((e, i) =>
        e.unnumbered ? (
          <p key={e.id ?? i} className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true">
            {e.text}
          </p>
        ) : (
          <p key={e.id ?? i} className={styles.entry}>
            <span className={styles.rubric}>
              {e.entry}
              {e.asterisk ? "*" : ""}
            </span>
            {e.text}
          </p>
        ),
      )}
      {day.conclusio && <Conclusio text={day.conclusio} />}
    </article>
  );
}
