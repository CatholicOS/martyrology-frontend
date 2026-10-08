"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/book.module.css";
import { editionTitle, isOriginal, languageLabel, natureLabel, titleCase, type ShelfState } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

/** The back of the cover: the edition as promulgated, then the printed copy its texts come from. */
function BackCover({ edition }: { edition: EditionOut }) {
  const t = useTranslations("Bookshelf");
  const { source, promulgation } = edition;
  const decree = typeof promulgation.decree === "string" ? promulgation.decree : null;
  return (
    <div className={styles.endpaper}>
      <p className={styles.backHeading}>
        {t("natureYear", { nature: natureLabel(t, edition.nature), year: String(edition.year) })}
      </p>
      {decree && <p>{decree}</p>}
      {source ? (
        <dl className={styles.colophon}>
          <dt>{t("colophonSource")}</dt>
          <dd className={styles.sourceTitle}>{source.title}</dd>
          {source.imprint && (
            <>
              <dt>{t("colophonImprint")}</dt>
              <dd>{source.imprint}</dd>
            </>
          )}
          {source.rights && (
            <>
              <dt>{t("colophonRights")}</dt>
              <dd>{source.rights}</dd>
            </>
          )}
          {source.isbn && (
            <>
              <dt>{t("colophonIsbn")}</dt>
              <dd>{source.isbn}</dd>
            </>
          )}
          {source.note && (
            <>
              <dt>{t("colophonNote")}</dt>
              <dd>{source.note}</dd>
            </>
          )}
        </dl>
      ) : (
        edition.availability.status === "unavailable" && (
          <p className={styles.noSource}>{t("noSource")}</p>
        )
      )}
    </div>
  );
}

/**
 * One edition as a tooled-leather book. Presentational: the shelf decides what a click does.
 * The © button beside the label turns the book round to show its colophon on the back cover.
 */
export default function BookCover({
  edition,
  state,
  opening = false,
  onClick,
}: {
  edition: EditionOut;
  state: ShelfState;
  opening?: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations("Bookshelf");
  const [turned, setTurned] = useState(false);
  const backId = useId();
  const title = editionTitle(edition);
  const label = languageLabel(t, edition);
  const name = t("bookName", { title: titleCase(title), year: String(edition.year), label });
  const tone =
    state === "unavailable" ? styles.unavailable : state === "locked" ? styles.locked : isOriginal(edition) ? styles.open : styles.dark;
  const face = (
    <>
      <span className={styles.frame} aria-hidden />
      <span className={styles.title} aria-hidden>{title}</span>
      {state === "locked" && <span className={styles.lock} aria-hidden>🔒</span>}
      <span className={styles.year} aria-hidden>{edition.year}</span>
    </>
  );
  return (
    <div className={styles.slot}>
      <div className={`${styles.turner} ${turned ? styles.turned : ""}`}>
        <div className={styles.front} inert={turned}>
          {state === "unavailable" ? (
            <div className={`${styles.book} ${tone}`} aria-label={t("bookNameUnavailable", { name })} role="img">
              {face}
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.book} ${tone} ${opening ? styles.opening : ""}`}
              aria-label={state === "locked" ? t("bookNameLocked", { name }) : name}
              onClick={onClick}
            >
              {face}
            </button>
          )}
        </div>
        <section
          id={backId}
          className={`${styles.back} ${tone}`}
          aria-label={t("aboutBook", { name })}
          inert={!turned}
        >
          <BackCover edition={edition} />
        </section>
      </div>
      <span className={styles.labelRow}>
        <span className={styles.label}>{state === "unavailable" ? t("notYetAvailable") : label}</span>
        <button
          type="button"
          className={styles.about}
          aria-label={t("aboutEditionNamed", { name })}
          aria-expanded={turned}
          aria-controls={backId}
          title={t("aboutEdition")}
          onClick={() => setTurned((v) => !v)}
        >
          ©
        </button>
      </span>
    </div>
  );
}
