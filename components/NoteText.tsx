import { Link } from "@/i18n/navigation";
import { isExternal, noteParts } from "@/lib/note-links";

/** A curator's note with the eulogies it names linked in the reader, and its Wikidata items in a new tab. */
export default function NoteText({ note, edition }: { note: string; edition: string }) {
  return noteParts(note, edition).map((p, i) =>
    !p.href ? (
      <span key={i}>{p.text}</span>
    ) : isExternal(p.href) ? (
      <a key={i} href={p.href} target="_blank" rel="noreferrer" className="underline">
        {p.text}
      </a>
    ) : (
      <Link key={i} href={p.href} className="underline">
        {p.text}
      </Link>
    ),
  );
}
