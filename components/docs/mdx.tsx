import type { MDXComponents } from "mdx/types";
import type { DocLang } from "@/lib/docs";

/** The components a docs page may use, with the page's language bound. */
export function docsComponents(lang: DocLang): MDXComponents {
  void lang;
  return {};
}
