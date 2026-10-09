import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { letterNeighbours, letterSlug } from "@/lib/letters";

/** An index's letters, each linking to its page (`<base>/<letter>`); the current one is marked, not linked. */
export function LetterBar({ letters, current, base, label }: { letters: string[]; current: string; base: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap justify-center gap-x-2 gap-y-1">
      {letters.map((l) =>
        l === current ? (
          <span key={l} aria-current="page" className="font-semibold">{l}</span>
        ) : (
          <Link key={l} href={`${base}/${letterSlug(l)}`} className="underline">{l}</Link>
        ),
      )}
    </nav>
  );
}

/** The previous and next letters' pages, at the foot of a letter. */
export function LetterPager({ letters, current, base }: { letters: string[]; current: string; base: string }) {
  const t = useTranslations("Letters");
  const { prev, next } = letterNeighbours(letters, current);
  return (
    <p className="mt-6 flex justify-between text-sm">
      {prev ? (
        <Link href={`${base}/${letterSlug(prev)}`} aria-label={t("previous", { letter: prev })} className="underline">← {prev}</Link>
      ) : <span />}
      {next ? (
        <Link href={`${base}/${letterSlug(next)}`} aria-label={t("next", { letter: next })} className="underline">{next} →</Link>
      ) : <span />}
    </p>
  );
}
