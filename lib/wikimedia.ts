/** A page or file title as Wikimedia URLs spell it: underscores for spaces, the rest percent-encoded. */
const title = (s: string) => encodeURIComponent(s.replace(/ /g, "_"));

/** A Commons file scaled to `width` px (Special:FilePath redirects to upload.wikimedia.org). */
export const commonsThumb = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${title(file)}?width=${width}`;

/** A Commons file's page, with its author and license. */
export const commonsPage = (file: string) => `https://commons.wikimedia.org/wiki/File:${title(file)}`;

export const wikipediaUrl = (lang: string, page: string) => `https://${lang}.wikipedia.org/wiki/${title(page)}`;

export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
