import { Fragment } from "react";
import { misprintsFor, splitMisprints } from "@/lib/misprints";

/**
 * A eulogy's text as printed in `edition`, with `[sic! expected: …]` after
 * each verified misprint. `noteClassName` styles the note for its setting.
 */
export default function EulogyText({
  text, id, edition, noteClassName = "text-[0.75em] text-slate-500 dark:text-slate-400",
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
          {s.intended && <span className={noteClassName}> [sic! expected: {s.intended}]</span>}
        </Fragment>
      ))}
    </>
  );
}
