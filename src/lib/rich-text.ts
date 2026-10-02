// Formato delle descrizioni voce: "markdown leggero".
//
// Le descrizioni restano TESTO nel DB (nessuna migrazione): un testo semplice
// è già un documento valido, quindi tutti i preventivi esistenti si vedono
// identici. La formattazione usa pochi marcatori:
//
//   **grassetto**   *corsivo*   __sottolineato__   ~~barrato~~
//   - voce elenco puntato        1. voce elenco numerato
//
// Ogni riga è un paragrafo. `\` fa l'escape di * _ ~ \ letterali.
// Da qui passano: editor (Tiptap JSON ↔ markdown), vista web, PDF ed export
// in chiaro (Excel/CSV/AI), così il formato vive in un solo posto.

export type Mark = "bold" | "italic" | "underline" | "strike";

export interface RichSpan {
  text: string;
  marks: Mark[];
}

export type RichBlock =
  | { type: "p"; spans: RichSpan[] }
  | { type: "ul"; items: RichSpan[][] }
  | { type: "ol"; start: number; items: RichSpan[][] };

/** Ordine fisso dei marcatori: tiene coerente l'annidamento in serializzazione. */
const MARK_ORDER: Mark[] = ["bold", "italic", "underline", "strike"];

const DELIMS: { token: string; mark: Mark }[] = [
  { token: "**", mark: "bold" },
  { token: "__", mark: "underline" },
  { token: "~~", mark: "strike" },
  { token: "*", mark: "italic" },
];

const ESCAPABLE = new Set(["\\", "*", "_", "~"]);
const BULLET_RE = /^\s*[-•]\s+(.*)$/;
const ORDERED_RE = /^\s*(\d{1,3})\.\s+(.*)$/;

/** True se il testo può contenere marcatori (altrimenti è testo puro). */
export function hasRichMarkup(src: string): boolean {
  return /[*_~\\]/.test(src) || /^\s*([-•]|\d{1,3}\.)\s/m.test(src);
}

/** Cerca un delimitatore di chiusura non escapato più avanti nella riga. */
function hasCloser(line: string, from: number, token: string): boolean {
  for (let i = from; i < line.length; i++) {
    if (line[i] === "\\") {
      i++;
      continue;
    }
    if (line.startsWith(token, i)) {
      // per "*" ignora i "**" (sono grassetto, non corsivo)
      if (token === "*" && line[i + 1] === "*") {
        i++;
        continue;
      }
      return line[i - 1] !== " ";
    }
  }
  return false;
}

export function parseInline(line: string): RichSpan[] {
  const spans: RichSpan[] = [];
  const active = new Set<Mark>();
  let buf = "";

  const flush = () => {
    if (!buf) return;
    spans.push({ text: buf, marks: MARK_ORDER.filter((m) => active.has(m)) });
    buf = "";
  };

  for (let i = 0; i < line.length; ) {
    const ch = line[i];
    if (ch === "\\" && ESCAPABLE.has(line[i + 1])) {
      buf += line[i + 1];
      i += 2;
      continue;
    }

    let matched = false;
    for (const { token, mark } of DELIMS) {
      if (!line.startsWith(token, i)) continue;
      const after = i + token.length;
      if (active.has(mark)) {
        // chiusura: per il corsivo serve un carattere non-spazio prima
        if (token === "*" && line[i - 1] === " ") break;
        flush();
        active.delete(mark);
      } else {
        const next = line[after];
        // apertura: mai seguita da spazio; "3*4" non è corsivo
        if (!next || next === " ") break;
        if (token === "*" && /\d/.test(line[i - 1] ?? "")) break;
        if (!hasCloser(line, after + 1, token)) break;
        flush();
        active.add(mark);
      }
      i = after;
      matched = true;
      break;
    }
    if (matched) continue;

    buf += ch;
    i++;
  }
  flush();
  return spans;
}

export function parseRichText(src: string | null | undefined): RichBlock[] {
  const text = (src ?? "").replace(/\r\n?/g, "\n");
  if (!text) return [];
  const blocks: RichBlock[] = [];

  for (const line of text.split("\n")) {
    const bullet = BULLET_RE.exec(line);
    const ordered = bullet ? null : ORDERED_RE.exec(line);
    const last = blocks[blocks.length - 1];

    if (bullet) {
      const spans = parseInline(bullet[1]);
      if (last?.type === "ul") last.items.push(spans);
      else blocks.push({ type: "ul", items: [spans] });
    } else if (ordered) {
      const spans = parseInline(ordered[2]);
      if (last?.type === "ol") last.items.push(spans);
      else blocks.push({ type: "ol", start: Number(ordered[1]) || 1, items: [spans] });
    } else {
      blocks.push({ type: "p", spans: parseInline(line) });
    }
  }
  return blocks;
}

function spansToPlain(spans: RichSpan[]): string {
  return spans.map((s) => s.text).join("");
}

/**
 * Testo in chiaro senza marcatori: per Excel/CSV, AI, listino, ricerche.
 * Un testo senza markup torna IDENTICO (spazi iniziali compresi).
 */
export function toPlainText(src: string | null | undefined): string {
  if (!src) return "";
  if (!hasRichMarkup(src)) return src;
  return parseRichText(src)
    .map((b) => {
      if (b.type === "p") return spansToPlain(b.spans);
      if (b.type === "ul") return b.items.map((it) => `- ${spansToPlain(it)}`).join("\n");
      return b.items.map((it, i) => `${b.start + i}. ${spansToPlain(it)}`).join("\n");
    })
    .join("\n");
}

// ─── Serializzazione inline ──────────────────────────────────────────────────

const MARK_TOKEN: Record<Mark, string> = {
  bold: "**",
  italic: "*",
  underline: "__",
  strike: "~~",
};

function escapeText(text: string): string {
  return text
    .replace(/\\(?=[\\*_~])/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/__/g, "\\_\\_")
    .replace(/~~/g, "\\~\\~");
}

/**
 * Serializza una sequenza di span mantenendo uno stack di marcatori aperti,
 * così "**a *b***" non diventa "**a****b***" (ambiguo).
 * Spazi iniziali/finali vengono portati fuori dai marcatori.
 */
export function serializeSpans(spans: RichSpan[]): string {
  let out = "";
  const stack: Mark[] = [];

  const closeFrom = (idx: number) => {
    while (stack.length > idx) out += MARK_TOKEN[stack.pop()!];
  };

  for (const span of spans) {
    if (!span.text) continue;
    const marks = MARK_ORDER.filter((m) => span.marks.includes(m));
    if (marks.length === 0) {
      closeFrom(0);
      out += escapeText(span.text);
      continue;
    }

    const lead = /^\s*/.exec(span.text)![0];
    const trail = span.text.length > lead.length ? /\s*$/.exec(span.text)![0] : "";
    const core = span.text.slice(lead.length, span.text.length - trail.length);

    if (!core) {
      // solo spazi: niente marcatori attorno
      closeFrom(0);
      out += span.text;
      continue;
    }

    let keep = 0;
    while (keep < stack.length && marks.includes(stack[keep])) keep++;
    closeFrom(keep);
    if (lead && stack.length) closeFrom(0);
    out += lead;
    for (const m of marks) {
      if (!stack.includes(m)) {
        stack.push(m);
        out += MARK_TOKEN[m];
      }
    }
    out += escapeText(core);
    if (trail) {
      closeFrom(0);
      out += trail;
    }
  }
  closeFrom(0);
  return out;
}

// ─── Tiptap / ProseMirror JSON ↔ markdown ───────────────────────────────────

interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: PMNode[];
}

function inlineFromPM(nodes: PMNode[] | undefined): RichSpan[] {
  const spans: RichSpan[] = [];
  for (const n of nodes ?? []) {
    if (n.type === "text" && n.text) {
      spans.push({
        text: n.text,
        marks: (n.marks ?? [])
          .map((m) => m.type as Mark)
          .filter((m) => MARK_ORDER.includes(m)),
      });
    } else if (n.type === "hardBreak") {
      spans.push({ text: "\n", marks: [] });
    }
  }
  return spans;
}

/** Testo di un listItem: paragrafi e sotto-elenchi appiattiti in una riga. */
function listItemSpans(item: PMNode): RichSpan[] {
  const parts: RichSpan[][] = [];
  const walk = (nodes: PMNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === "paragraph") parts.push(inlineFromPM(n.content));
      else if (n.content) walk(n.content);
    }
  };
  walk(item.content);
  return parts.flatMap((p, i) => (i === 0 ? p : [{ text: " ", marks: [] }, ...p]));
}

/** Un hardBreak (Maiusc+Invio) diventa una riga nuova, come un paragrafo. */
function linesFromSpans(spans: RichSpan[]): string[] {
  const lines: RichSpan[][] = [[]];
  for (const s of spans) {
    if (s.text === "\n") lines.push([]);
    else lines[lines.length - 1].push(s);
  }
  return lines.map(serializeSpans);
}

export function docToRichText(doc: PMNode): string {
  const lines: string[] = [];
  for (const block of doc.content ?? []) {
    if (block.type === "paragraph") {
      lines.push(...linesFromSpans(inlineFromPM(block.content)));
    } else if (block.type === "bulletList") {
      for (const it of block.content ?? []) {
        lines.push(`- ${serializeSpans(listItemSpans(it).filter((s) => s.text !== "\n"))}`);
      }
    } else if (block.type === "orderedList") {
      const start = Number(block.attrs?.start ?? 1) || 1;
      (block.content ?? []).forEach((it, i) => {
        lines.push(`${start + i}. ${serializeSpans(listItemSpans(it).filter((s) => s.text !== "\n"))}`);
      });
    } else if (block.content) {
      lines.push(...linesFromSpans(inlineFromPM(block.content)));
    }
  }
  // Tiptap lascia sempre un paragrafo finale vuoto: non salvarlo come "\n".
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function spansToPM(spans: RichSpan[]): PMNode[] {
  return spans
    .filter((s) => s.text)
    .map((s) => ({
      type: "text",
      text: s.text,
      ...(s.marks.length ? { marks: s.marks.map((m) => ({ type: m })) } : {}),
    }));
}

function paragraphPM(spans: RichSpan[]): PMNode {
  const content = spansToPM(spans);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

export function richTextToDoc(src: string | null | undefined): PMNode {
  const blocks = parseRichText(src);
  const content: PMNode[] = blocks.map((b) => {
    if (b.type === "p") return paragraphPM(b.spans);
    const items = b.items.map((it) => ({ type: "listItem", content: [paragraphPM(it)] }));
    return b.type === "ul"
      ? { type: "bulletList", content: items }
      : { type: "orderedList", attrs: { start: b.start }, content: items };
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
