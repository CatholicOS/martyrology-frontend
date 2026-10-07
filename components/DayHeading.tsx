"use client";

import { useEffect, useId, useState } from "react";
import styles from "@/components/page.module.css";
import { getDay } from "@/lib/api";
import { pad2 } from "@/lib/calendar";
import { ageWords, printedRows, splitLuna, validYear } from "@/lib/luna";
import type { Luna, LunaAnnouncement } from "@/lib/types";

/** The year's letter, epact and golden number, as the age's tooltip. */
function derivation(a: LunaAnnouncement): string {
  return `${a.year}: golden number ${a.golden_number}, epact ${a.epact}, letter ${a.letter}`;
}

/** The printed lunar table in its printed rows, with the year's column marked. A misprinted cell shows the number as
 * printed, with the age by the computus in a small row under it. */
function LunarTable({ luna, column }: { luna: Luna; column: number | null }) {
  const misprinted = luna.tabula.some((c) => c.printed !== null);
  const mark = (k: number, red?: boolean) =>
    [k === column ? styles.lunaYear : "", red ? styles.lunaRed : ""].join(" ").trim() || undefined;
  return (
    <>
      <div className={styles.lunaScroll}>
        <table className={styles.lunaTable}>
          <caption className={styles.srOnly}>The moon&apos;s age under each letter of the Martyrology</caption>
          <tbody>
            {printedRows(luna.tabula, luna.rows).flatMap((row, r) => [
              <tr key={`l${r}`} className={styles.lunaLetters}>
                {row.map(({ column: k, cell }) => (
                  <th key={k} scope="col" className={mark(k, cell.red)} title={`epact ${cell.epact}`}>
                    {cell.letter}
                  </th>
                ))}
              </tr>,
              <tr key={`a${r}`}>
                {row.map(({ column: k, cell }) => (
                  <td
                    key={k}
                    className={mark(k)}
                    aria-current={k === column ? "true" : undefined}
                    title={cell.printed !== null ? `printed ${cell.printed}; by the computus ${cell.age}` : undefined}
                  >
                    {cell.printed ?? cell.age}
                    {cell.printed !== null && <span className={styles.lunaSic}>*</span>}
                  </td>
                ))}
              </tr>,
              ...(row.some(({ cell }) => cell.printed !== null)
                ? [
                    <tr key={`c${r}`} className={styles.lunaComputed}>
                      {row.map(({ column: k, cell }) => (
                        <td key={k} className={mark(k)}>
                          {cell.printed !== null ? cell.age : ""}
                        </td>
                      ))}
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </table>
      </div>
      {misprinted && <p className={styles.lunaNote}>* As printed; below it, the age by the computus.</p>}
    </>
  );
}

/**
 * A day's heading. For an edition that prints the lunar table, the heading's bare "Luna." is completed with the age
 * announced in the year (*Luna vigesima.*), and the table follows on demand as a collapsible "Lunar table" with the
 * year's column highlighted. The year is the reader's own; another can be asked for in the panel.
 */
export default function DayHeading({
  titulus, edition, mm, dd, luna: initial,
}: { titulus: string; edition?: string; mm?: number; dd?: number; luna?: Luna | null }) {
  const [luna, setLuna] = useState<Luna | null>(initial ?? null);
  const [yearInput, setYearInput] = useState(String(initial?.annuntiatio?.year ?? ""));
  const [failed, setFailed] = useState(false);
  const yearId = useId();
  const year = validYear(yearInput);
  const shownYear = luna?.annuntiatio?.year ?? null;

  useEffect(() => {
    if (!initial || !edition || !mm || !dd || year === null || year === shownYear) return;
    let cancelled = false;
    getDay(edition, pad2(mm), pad2(dd), year).then(
      (d) => {
        if (cancelled) return;
        setFailed(false);
        if (d.luna) setLuna(d.luna);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [initial, edition, mm, dd, year, shownYear]);

  if (!luna) return <h2 className={styles.heading}>{titulus}</h2>;
  const a = luna.annuntiatio;
  const split = splitLuna(titulus);
  const age = a && (
    <span className={styles.lunaAge} title={derivation(a)}>
      {ageWords(a.pronuntiatio)}
    </span>
  );
  return (
    <>
      <h2 className={styles.heading}>
        {split ? (
          <>
            {split.before}Luna{age ? <> {age}</> : null}.{split.after}
          </>
        ) : (
          titulus
        )}
      </h2>
      {!split && a && <p className={styles.lunaLine}>Luna {age}.</p>}
      <details className={styles.luna}>
        <summary>Lunar table</summary>
        <LunarTable luna={luna} column={a?.column ?? null} />
        <p className={styles.lunaNote}>
          <label htmlFor={yearId}>Year</label>{" "}
          <input
            id={yearId}
            className={styles.lunaYearInput}
            inputMode="numeric"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value.trim())}
          />{" "}
          {a ? (
            <>
              golden number {a.golden_number}, epact {a.epact}, letter <b>{a.letter}</b>: <i>{a.pronuntiatio}</i>.
            </>
          ) : (
            <>no announcement before the Gregorian reform (1583).</>
          )}
          {failed && <> The year couldn&apos;t be loaded.</>}
        </p>
        {luna.dominical_letter && (
          <p className={styles.lunaNote}>
            In the margin: dominical letter {luna.dominical_letter}
            {luna.epactae && luna.epactae.length > 0 && <>; new moon of epact {luna.epactae.join(", ")}</>}.
          </p>
        )}
      </details>
    </>
  );
}
