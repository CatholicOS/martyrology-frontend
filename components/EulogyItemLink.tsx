import { useTranslations } from "next-intl";
import type { EulogyItem } from "@/lib/snapshot";

/** The Wikidata item of a eulogy that commemorates no single person (a group, feast, church or
 * translation), labelled by its kind; nothing for the others. */
export default function EulogyItemLink({ item, className }: { item: EulogyItem | null | undefined; className?: string }) {
  const t = useTranslations("EulogyItem");
  if (!item) return null;
  return (
    <a className={className} href={`https://www.wikidata.org/wiki/${item.wikidata}`} target="_blank" rel="noreferrer">
      {t(item.kind)}
    </a>
  );
}
