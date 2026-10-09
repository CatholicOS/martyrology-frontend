import { Fragment } from "react";
import CuratorNotes from "@/components/CuratorNotes";
import DayHeading from "@/components/DayHeading";
import Eulogy from "@/components/Eulogy";
import { PrefetchEntities } from "@/components/markup/Markup";
import styles from "@/components/page.module.css";
import PrintedFootnotes from "@/components/PrintedFootnotes";
import { pageFootnotes, type PageFootnote } from "@/lib/footnotes";
import { pageNotes } from "@/lib/notes";
import type { DayContentOut, DayOut } from "@/lib/types";

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

/** The rubrics a day prints after eulogy `after` (null: at the head of the day), in red. */
export function Rubricae({ day, after }: { day: DayContentOut; after: string | null }) {
  const here = (day.rubricae ?? []).filter((r) => r.after === after);
  return here.map((r, i) => (
    <p key={i} className={styles.rubrica}>
      {r.text}
    </p>
  ));
}

/**
 * A day's heading: its titulus (else `heading`), with the moon announced and the lunar table when the edition prints
 * one. Keyed on the edition and day, so the year asked for starts afresh on each day.
 */
export function DayTitle({ day, heading, edition }: { day: DayContentOut; heading: string; edition?: string }) {
  const meta = (day as Partial<DayOut>).metadata;
  return (
    <DayHeading
      key={`${edition}|${meta?.month}|${meta?.day}`}
      titulus={day.titulus || heading}
      edition={edition}
      mm={meta?.month}
      dd={meta?.day ?? undefined}
      luna={day.luna}
    />
  );
}

/**
 * One day typeset as a printed page. `heading` is used when the edition prints no titulus;
 * `edition` (a CLBDR edition id) selects the misprint notes; `showIds` sets each eulogy's canonical id above it
 * and the curators' notes at the foot of the page. The edition's own footnotes are always shown.
 */
export default function DayPage({
  day, heading, lang, edition, showIds = false,
}: { day: DayContentOut; heading: string; lang?: "la" | "it" | "en"; edition?: string; showIds?: boolean }) {
  const notes = showIds ? pageNotes(day.elogia.map((e) => e.id), edition ?? "") : [];
  const noteAt = new Map(notes.map((n) => [n.at, n]));
  const footnotes = pageFootnotes(day.elogia, edition ?? "");
  const footAt = new Map<number, PageFootnote[]>();
  for (const f of footnotes) footAt.set(f.at, [...(footAt.get(f.at) ?? []), f]);
  return (
    <article className={styles.page} lang={lang}>
      <PrefetchEntities elogia={day.elogia} />
      <DayTitle day={day} heading={heading} edition={edition} />
      <Rubricae day={day} after={null} />
      {day.elogia.map((e, i) => (
        <Fragment key={e.id ?? i}>
          <Eulogy e={e} edition={edition} showId={showIds} note={noteAt.get(i)} footnotes={footAt.get(i)} />
          {e.id && <Rubricae day={day} after={e.id} />}
        </Fragment>
      ))}
      {day.conclusio && <Conclusio text={day.conclusio} />}
      <PrintedFootnotes notes={footnotes} lang={lang} edition={edition} />
      <CuratorNotes notes={notes} edition={edition ?? ""} />
    </article>
  );
}
