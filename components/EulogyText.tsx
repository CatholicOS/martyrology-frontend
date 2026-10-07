import { Fragment, type ReactNode } from "react";
import { FootnoteMark } from "@/components/PrintedFootnotes";
import { footnoteOffsets, type PageFootnote } from "@/lib/footnotes";
import { erratumPlace, splitErrata } from "@/lib/errata";
import { misprintsFor, splitMisprints, type TextSegment } from "@/lib/misprints";
import type { Erratum } from "@/lib/types";

/**
 * An erratum the edition prints, after the words it concerns: "[Errata: Bononiæ]",
 * "[Errata: adde Romæ]", "[Errata: dele]". The erratum as printed and its place show on hover
 * (title) and, for keyboard readers, while it has focus; screen readers get them in its name.
 */
export function ErratumNote({ e, className }: { e: Erratum; className: string }) {
  const reading =
    e.kind === "replace" ? <i>{e.corrected}</i> : e.kind === "add" ? <>adde <i>{e.corrected}</i></> : <>dele</>;
  const said = e.kind === "replace" ? e.corrected : e.kind === "add" ? `adde ${e.corrected}` : "dele";
  const where = `${erratumPlace(e.ref)}: ${e.entry}`;
  return (
    <span
      className={className}
      style={{ fontStyle: "normal" }}
      title={`Errata (${where})`}
      tabIndex={0}
      role="note"
      aria-label={`Errata: ${said}. ${where}`}
      data-entry={where}
    >
      {" "}[<span style={{ fontVariant: "small-caps" }}>Errata</span>: {reading}]
    </span>
  );
}

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after each verified misprint
 * (set upright with *sic!* in italics, as in critical editions), each printed footnote's mark after
 * its phrase, and the edition's own errata in place: the words a correction concerns underlined
 * (struck through for a deletion), then "[Errata: …]". `noteClassName` sets the misprint note's size
 * and colour, `errataClassName` the errata's.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.8em] text-slate-600 dark:text-slate-300", footnotes = [], errata = [],
  errataClassName = "text-[0.8em] text-amber-900 dark:text-amber-200",
}: {
  text: string; id: string | null; edition: string; noteClassName?: string; footnotes?: PageFootnote[];
  errata?: Erratum[]; errataClassName?: string;
}) {
  const misprints = misprintsFor(edition, id);
  if (misprints.length === 0 && footnotes.length === 0 && errata.length === 0) return <>{text}</>;
  // No text to place them in: the marks alone, so each footnote's link back has a target.
  if (!text) return <>{footnotes.map((f) => <FootnoteMark key={f.anchor} note={f} />)}</>;
  const marks = footnoteOffsets(text, footnotes);
  // Each run's span of the text, so a mark lands in the run its offset falls in.
  const runs: { s: TextSegment; start: number; end: number }[] = [];
  let pos = 0;
  for (const s of splitErrata(splitMisprints(text, misprints), errata)) {
    runs.push({ s, start: pos, end: pos + s.text.length });
    pos += s.text.length;
  }
  return (
    <>
      {runs.map(({ s, start, end }, i) => {
        const parts: ReactNode[] = [];
        let cut = 0;
        for (const m of marks.filter((m) => m.at > start && m.at <= end)) {
          parts.push(<Fragment key={`t${m.footnote.anchor}`}>{s.text.slice(cut, m.at - start)}</Fragment>);
          parts.push(<FootnoteMark key={m.footnote.anchor} note={m.footnote} />);
          cut = m.at - start;
        }
        parts.push(<Fragment key="rest">{s.text.slice(cut)}</Fragment>);
        const e = s.erratum;
        // The words a correction concerns: dotted underline, struck through for a deletion.
        const words =
          e && e.kind !== "add" ? (
            e.kind === "delete" ? (
              <del title={`Errata (${erratumPlace(e.ref)}): ${e.entry}`}>{parts}</del>
            ) : (
              <span style={{ textDecoration: "underline dotted" }}>{parts}</span>
            )
          ) : (
            parts
          );
        return (
          <Fragment key={i}>
            {words}
            {e && <ErratumNote e={e} className={errataClassName} />}
            {s.intended && (
              <span className={noteClassName} style={{ fontStyle: "normal" }}>
                {" "}[<i>sic!</i> expected: {s.intended}]
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
