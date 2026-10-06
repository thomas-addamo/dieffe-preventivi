import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  type PMMark,
  type PMNode,
} from "@/lib/communications";

// Converte il documento dell'editor (JSON Tiptap) in elementi react-pdf,
// mantenendo grassetto, corsivo, sottolineato, barrato, dimensione, font,
// colore, evidenziazione, allineamento, titoli, elenchi e citazioni.
// Usa solo i font standard PDF (Helvetica / Times / Courier).

type Family = "Helvetica" | "Times-Roman" | "Courier";

const VARIANTS: Record<Family, { b: string; i: string; bi: string }> = {
  Helvetica: { b: "Helvetica-Bold", i: "Helvetica-Oblique", bi: "Helvetica-BoldOblique" },
  "Times-Roman": { b: "Times-Bold", i: "Times-Italic", bi: "Times-BoldItalic" },
  Courier: { b: "Courier-Bold", i: "Courier-Oblique", bi: "Courier-BoldOblique" },
};

function familyFor(value: unknown): Family {
  const f = FONT_FAMILIES.find((x) => x.value === value);
  return (f?.pdf ?? "Helvetica") as Family;
}

function fontName(family: Family, bold: boolean, italic: boolean): string {
  if (bold && italic) return VARIANTS[family].bi;
  if (bold) return VARIANTS[family].b;
  if (italic) return VARIANTS[family].i;
  return family;
}

/** "14pt" | "14px" | "14" → punti. */
function parseSize(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(v).endsWith("px") ? n * 0.75 : n;
}

function isColor(v: unknown): v is string {
  return typeof v === "string" && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(v.trim());
}

interface Ctx {
  family: Family;
  bold: boolean;
}

function textStyle(marks: PMMark[] = [], ctx: Ctx): Style {
  let bold = ctx.bold;
  let italic = false;
  let family = ctx.family;
  const deco: string[] = [];
  const style: Style = {};

  for (const m of marks) {
    switch (m.type) {
      case "bold":
        bold = true;
        break;
      case "italic":
        italic = true;
        break;
      case "underline":
        deco.push("underline");
        break;
      case "strike":
        deco.push("line-through");
        break;
      case "highlight":
        style.backgroundColor = isColor(m.attrs?.color) ? m.attrs.color : "#fef08a";
        break;
      case "textStyle": {
        const size = parseSize(m.attrs?.fontSize);
        if (size) style.fontSize = size;
        if (m.attrs?.fontFamily) family = familyFor(m.attrs.fontFamily);
        if (isColor(m.attrs?.color)) style.color = m.attrs.color;
        if (isColor(m.attrs?.backgroundColor)) style.backgroundColor = m.attrs.backgroundColor;
        break;
      }
    }
  }
  style.fontFamily = fontName(family, bold, italic);
  if (deco.length) style.textDecoration = deco.join(" ") as Style["textDecoration"];
  return style;
}

function Inline({ nodes, ctx }: { nodes: PMNode[] | undefined; ctx: Ctx }) {
  if (!nodes || nodes.length === 0) return <>{" "}</>;
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "hardBreak") return <Text key={i}>{"\n"}</Text>;
        if (n.type !== "text" || !n.text) return null;
        return (
          <Text key={i} style={textStyle(n.marks, ctx)}>
            {n.text}
          </Text>
        );
      })}
    </>
  );
}

function align(node: PMNode): Style["textAlign"] {
  const a = node.attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : "left";
}

const HEADING_SIZES: Record<number, number> = { 1: 18, 2: 15, 3: 13 };

function Block({ node, ctx, last }: { node: PMNode; ctx: Ctx; last: boolean }) {
  const gap = last ? 0 : 6;
  switch (node.type) {
    case "paragraph":
      return (
        <Text style={{ textAlign: align(node), marginBottom: gap }}>
          <Inline nodes={node.content} ctx={ctx} />
        </Text>
      );
    case "heading": {
      const level = Number(node.attrs?.level) || 2;
      return (
        <Text
          style={{
            textAlign: align(node),
            fontSize: HEADING_SIZES[level] ?? 13,
            marginTop: 4,
            marginBottom: last ? 0 : 6,
            lineHeight: 1.25,
          }}
        >
          <Inline nodes={node.content} ctx={{ ...ctx, bold: true }} />
        </Text>
      );
    }
    case "bulletList":
    case "orderedList": {
      const start = Number(node.attrs?.start) || 1;
      return (
        <View style={{ marginBottom: gap }}>
          {(node.content ?? []).map((item, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ width: node.type === "bulletList" ? 12 : 18 }}>
                {node.type === "bulletList" ? "•" : `${start + i}.`}
              </Text>
              <View style={{ flex: 1 }}>
                <Blocks nodes={item.content} ctx={ctx} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    case "blockquote":
      return (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: "#cbd5e1",
            paddingLeft: 10,
            marginBottom: gap,
            color: "#475569",
          }}
        >
          <Blocks nodes={node.content} ctx={ctx} />
        </View>
      );
    case "horizontalRule":
      return (
        <View
          style={{ borderBottomWidth: 0.75, borderBottomColor: "#d4d4d8", marginVertical: 8 }}
        />
      );
    default:
      return node.content ? <Blocks nodes={node.content} ctx={ctx} /> : null;
  }
}

function Blocks({ nodes, ctx }: { nodes: PMNode[] | undefined; ctx: Ctx }) {
  const list = nodes ?? [];
  return (
    <>
      {list.map((n, i) => (
        <Block key={i} node={n} ctx={ctx} last={i === list.length - 1} />
      ))}
    </>
  );
}

export function PdfDocBody({ doc }: { doc: PMNode }) {
  return (
    <View style={{ fontSize: DEFAULT_FONT_SIZE, lineHeight: 1.45, fontFamily: "Helvetica" }}>
      <Blocks nodes={doc.content} ctx={{ family: "Helvetica", bold: false }} />
    </View>
  );
}
