import type { CSSProperties, ReactNode } from "react";
import { hasRichMarkup, parseRichText, type RichSpan } from "@/lib/rich-text";

// Vista in sola lettura delle descrizioni formattate (vedi lib/rich-text).
// Usa stili inline: è riusata anche nella pagina pubblica del cliente, che
// non dipende dalle utility Tailwind.

const LIST_STYLE: CSSProperties = { margin: 0, paddingLeft: "1.25em" };

export function RichSpans({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        let node: ReactNode = s.text;
        if (s.marks.includes("strike")) node = <s>{node}</s>;
        if (s.marks.includes("underline")) node = <u>{node}</u>;
        if (s.marks.includes("italic")) node = <em>{node}</em>;
        if (s.marks.includes("bold")) node = <strong style={{ fontWeight: 600 }}>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

export function RichText({
  value,
  className,
  style,
}: {
  value: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  if (!value) return null;

  // Testo semplice: resa identica a prima (a capo e spazi preservati).
  if (!hasRichMarkup(value)) {
    return (
      <div className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
        {value}
      </div>
    );
  }

  return (
    <div className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {parseRichText(value).map((b, i) => {
        if (b.type === "p") {
          return (
            <div key={i}>{b.spans.length ? <RichSpans spans={b.spans} /> : <br />}</div>
          );
        }
        const items = b.items.map((it, j) => (
          <li key={j} style={{ paddingLeft: "0.15em" }}>
            <RichSpans spans={it} />
          </li>
        ));
        return b.type === "ul" ? (
          <ul key={i} style={{ ...LIST_STYLE, listStyleType: "disc" }}>{items}</ul>
        ) : (
          <ol key={i} start={b.start} style={{ ...LIST_STYLE, listStyleType: "decimal" }}>
            {items}
          </ol>
        );
      })}
    </div>
  );
}
