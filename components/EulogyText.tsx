import { Fragment, type ReactNode } from "react";
import { FootnoteMark } from "@/components/PrintedFootnotes";
import { footnoteOffsets, type PageFootnote } from "@/lib/footnotes";
import { misprintsFor, splitMisprints, type TextSegment } from "@/lib/misprints";

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after each verified misprint
 * (set upright with *sic!* in italics, as in critical editions) and each printed footnote's mark after
 * its phrase. `noteClassName` sets the misprint note's size and colour.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.8em] text-slate-600 dark:text-slate-300", footnotes = [],
}: {
  text: string; id: string | null; edition: string; noteClassName?: string; footnotes?: PageFootnote[];
}) {
  const misprints = misprintsFor(edition, id);
  if (misprints.length === 0 && footnotes.length === 0) return <>{text}</>;
  // No text to place them in: the marks alone, so each footnote's link back has a target.
  if (!text) return <>{footnotes.map((f) => <FootnoteMark key={f.anchor} note={f} />)}</>;
  const marks = footnoteOffsets(text, footnotes);
  // Each run's span of the text, so a mark lands in the run its offset falls in.
  const runs: { s: TextSegment; start: number; end: number }[] = [];
  let pos = 0;
  for (const s of splitMisprints(text, misprints)) {
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
        return (
          <Fragment key={i}>
            {parts}
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
