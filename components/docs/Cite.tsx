import type { DocLang } from "@/lib/docs";

const NAMES: Record<DocLang, { praenotanda: string; ordo: string }> = {
  en: { praenotanda: "Praenotanda", ordo: "Ordo" },
  it: { praenotanda: "Premesse", ordo: "Rito" },
};

/**
 * A citation of the 2004 Praenotanda or of its Ordo lectionis Martyrologii by paragraph:
 * "(Praenotanda, n. 29)", "(Rito, n. 11)"; a range "38-39" reads "nn. 38–39".
 */
export function Cite({ lang, n, ordo = false }: { lang: DocLang; n: string; ordo?: boolean }) {
  const range = n.includes("-");
  const name = NAMES[lang][ordo ? "ordo" : "praenotanda"];
  return <span className="whitespace-nowrap">({name}, {range ? "nn." : "n."} {n.replace("-", "–")})</span>;
}
