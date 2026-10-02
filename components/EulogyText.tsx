import { Fragment } from "react";
import { misprintsFor, splitMisprints } from "@/lib/misprints";

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after
 * each verified misprint: the editorial note is set upright with *sic!* in
 * italics, as in critical editions. `noteClassName` sets its size and colour.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.8em] text-slate-600 dark:text-slate-300",
}: {
  text: string; id: string | null; edition: string; noteClassName?: string;
}) {
  const misprints = misprintsFor(edition, id);
  if (misprints.length === 0) return <>{text}</>;
  return (
    <>
      {splitMisprints(text, misprints).map((s, i) => (
        <Fragment key={i}>
          {s.text}
          {s.intended && (
            <span className={noteClassName} style={{ fontStyle: "normal" }}>
              {" "}[<i>sic!</i> expected: {s.intended}]
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}
