import styles from "@/components/book.module.css";
import { editionTitle, isOriginal, languageLabel, titleCase, type ShelfState } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

/** One edition as a tooled-leather book. Presentational: the shelf decides what a click does. */
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
  const title = editionTitle(edition);
  const label = languageLabel(edition);
  const name = `${titleCase(title)} ${edition.year}, ${label}`;
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
      {state === "unavailable" ? (
        <div className={`${styles.book} ${tone}`} aria-label={`${name} (not yet available)`} role="img">
          {face}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.book} ${tone} ${opening ? styles.opening : ""}`}
          aria-label={state === "locked" ? `${name} (locked)` : name}
          onClick={onClick}
        >
          {face}
        </button>
      )}
      <span className={styles.label}>{state === "unavailable" ? "not yet available" : label}</span>
    </div>
  );
}
