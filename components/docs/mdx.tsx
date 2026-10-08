import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { Cite } from "@/components/docs/Cite";
import { LunarFinder } from "@/components/docs/LunarFinder";
import { SampleDay } from "@/components/docs/SampleDay";
import styles from "@/components/docs/docs.module.css";
import type { DocLang } from "@/lib/docs";

/** The components a docs page may use, with the page's language bound: <Cite n="29" />, <SampleDay />, <LunarFinder />, <Rubric>. */
export function docsComponents(lang: DocLang): MDXComponents {
  return {
    Cite: (p: { n: string; ordo?: boolean }) => <Cite lang={lang} {...p} />,
    SampleDay: () => <SampleDay lang={lang} />,
    LunarFinder: () => <LunarFinder lang={lang} />,
    Rubric: ({ children }: { children?: ReactNode }) => <span className={styles.rubric}>{children}</span>,
    Banner: ({ children }: { children?: ReactNode }) => <div className={styles.banner} role="note">{children}</div>,
  };
}
