import { splitHighlight } from '../utils/highlight'

/** Renders text with `<mark>` around case-insensitive matches of `query`. */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-300/80 px-0.5 text-inherit dark:bg-amber-400/50"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}
