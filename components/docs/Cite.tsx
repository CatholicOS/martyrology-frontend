import { useTranslations } from "next-intl";

/**
 * A citation of the 2004 Praenotanda or of its Ordo lectionis Martyrologii by paragraph, named in the
 * interface language: "(Praenotanda, n. 29)", "(Rito, n. 11)"; a range "38-39" reads "nn. 38–39".
 */
export function Cite({ n, ordo = false }: { n: string; ordo?: boolean }) {
  const t = useTranslations("Docs.cite");
  const range = n.includes("-");
  return <span className="whitespace-nowrap">({t(ordo ? "ordo" : "praenotanda")}, {range ? "nn." : "n."} {n.replace("-", "–")})</span>;
}
