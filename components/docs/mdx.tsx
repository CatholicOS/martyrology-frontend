import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { Cite } from "@/components/docs/Cite";
import { LunarFinder } from "@/components/docs/LunarFinder";
import { SampleDay } from "@/components/docs/SampleDay";
import styles from "@/components/docs/docs.module.css";

/** The components a docs page may use: <Cite n="29" />, <SampleDay />, <LunarFinder />, <Rubric>, <Banner>. They read the interface language themselves. */
export const docsComponents: MDXComponents = {
  Cite,
  SampleDay,
  LunarFinder,
  Rubric: ({ children }: { children?: ReactNode }) => <span className={styles.rubric}>{children}</span>,
  Banner: ({ children }: { children?: ReactNode }) => <div className={styles.banner} role="note">{children}</div>,
};
