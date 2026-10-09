import { useTranslations } from "next-intl";
import { Fragment, useMemo, type ReactNode } from "react";
import { useMarkup } from "@/components/markup/Markup";
import { MentionRun } from "@/components/markup/MentionPiece";
import { FootnoteMark } from "@/components/PrintedFootnotes";
import { footnoteOffsets, type PageFootnote } from "@/lib/footnotes";
import { erratumPlace, splitErrata } from "@/lib/errata";
import { mentionsIn } from "@/lib/mentions";
import { misprintsFor, splitMisprints, type TextSegment } from "@/lib/misprints";
import type { Erratum, Mention } from "@/lib/types";

/**
 * An erratum the edition prints, after the words it concerns: "[Errata: Bononiæ]",
 * "[Errata: adde Romæ]", "[Errata: dele]". The erratum as printed and its place show on hover
 * (title) and, for keyboard readers, while it has focus; screen readers get them in its name.
 */
export function ErratumNote({ e, className }: { e: Erratum; className: string }) {
  const t = useTranslations("Reader");
  const reading =
    e.kind === "replace" ? <i>{e.corrected}</i> : e.kind === "add" ? <>adde <i>{e.corrected}</i></> : <>dele</>;
  const said = e.kind === "replace" ? e.corrected : e.kind === "add" ? `adde ${e.corrected}` : "dele";
  const where = `${erratumPlace(t, e.ref)}: ${e.entry}`;
  return (
    <span
      className={className}
      style={{ fontStyle: "normal" }}
      title={t("erratumTitle", { where })}
      tabIndex={0}
      role="note"
      aria-label={t("erratumLabel", { said, where })}
      data-entry={where}
    >
      {/* set before the words an addition opens, after the words of any other */}
      {e.position === "before" ? "" : " "}[<span style={{ fontVariant: "small-caps" }}>{t("errata")}</span>: {reading}]
      {e.position === "before" ? " " : ""}
    </span>
  );
}

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after each verified misprint
 * (set upright with *sic!* in italics, as in critical editions), each printed footnote's mark after
 * its phrase, and the edition's own errata in place: the words a correction concerns underlined
 * (struck through for a deletion), then "[Errata: …]". `noteClassName` sets the misprint note's size
 * and colour, `errataClassName` the errata's. `mentions` are the persons and places it names, marked while
 * "Names & places" is on.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.8em] text-slate-600 dark:text-slate-300", footnotes = [], errata = [],
  errataClassName = "text-[0.8em] text-amber-900 dark:text-amber-200", mentions,
}: {
  text: string; id: string | null; edition: string; noteClassName?: string; footnotes?: PageFootnote[];
  errata?: Erratum[]; errataClassName?: string; mentions?: Mention[];
}) {
  const t = useTranslations("Reader");
  const misprints = misprintsFor(edition, id);
  const on = useMarkup() !== null;
  const marked = useMemo(
    () => (on ? mentionsIn(mentions, "text", edition, id ?? "", text.length) : []),
    [on, mentions, edition, id, text.length],
  );
  if (misprints.length === 0 && footnotes.length === 0 && errata.length === 0 && marked.length === 0) return <>{text}</>;
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
          parts.push(
            <Fragment key={`t${m.footnote.anchor}`}>
              <MentionRun text={text} from={start + cut} to={m.at} mentions={marked} edition={edition} />
            </Fragment>,
          );
          parts.push(<FootnoteMark key={m.footnote.anchor} note={m.footnote} />);
          cut = m.at - start;
        }
        // The runs partition the text, so this is the run's own text from `cut` on, its mentions' pieces marked.
        parts.push(
          <Fragment key="rest">
            <MentionRun text={text} from={start + cut} to={end} mentions={marked} edition={edition} />
          </Fragment>,
        );
        const e = s.erratum;
        // The words a correction concerns: dotted underline, struck through for a deletion.
        const words =
          e && e.kind !== "add" ? (
            e.kind === "delete" ? (
              <del title={t("erratumTitle", { where: `${erratumPlace(t, e.ref)}: ${e.entry}` })}>{parts}</del>
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
                {" "}[{t.rich("sic", { intended: s.intended, i: (c) => <i>{c}</i> })}]
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
