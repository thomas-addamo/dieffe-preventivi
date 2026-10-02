import { Text, View } from "@react-pdf/renderer";
import type { ComponentProps } from "react";
import { hasRichMarkup, parseRichText, type RichSpan } from "@/lib/rich-text";

// Descrizione formattata nel PDF (react-pdf). Helvetica standard ha già le
// varianti Bold/Oblique/BoldOblique: nessun font da registrare.

function fontFor(marks: RichSpan["marks"]): string {
  const bold = marks.includes("bold");
  const italic = marks.includes("italic");
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function Spans({ spans }: { spans: RichSpan[] }) {
  if (spans.length === 0) return <>{" "}</>;
  return (
    <>
      {spans.map((sp, i) => {
        const deco = [
          sp.marks.includes("underline") ? "underline" : null,
          sp.marks.includes("strike") ? "line-through" : null,
        ].filter(Boolean);
        return (
          <Text
            key={i}
            style={{
              fontFamily: fontFor(sp.marks),
              ...(deco.length
                ? { textDecoration: deco.join(" ") as "underline" | "line-through" }
                : {}),
            }}
          >
            {sp.text}
          </Text>
        );
      })}
    </>
  );
}

type PdfStyle = NonNullable<ComponentProps<typeof View>["style"]>;

export function PdfRichText({ value, style }: { value: string; style: PdfStyle }) {
  // Testo semplice: identico al rendering precedente.
  if (!hasRichMarkup(value)) return <Text style={style}>{value}</Text>;

  return (
    <View style={style}>
      {parseRichText(value).map((b, i) => {
        if (b.type === "p") {
          return (
            <Text key={i}>
              <Spans spans={b.spans} />
            </Text>
          );
        }
        return (
          <View key={i}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: "row" }}>
                <Text style={{ width: b.type === "ul" ? 8 : 12 }}>{b.type === "ul" ? "•" : `${b.start + j}.`}</Text>
                <Text style={{ flex: 1 }}>
                  <Spans spans={it} />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
