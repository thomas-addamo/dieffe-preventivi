import type { QuoteWithRelations } from "@/types";
import path from "path";
import fs from "fs";

export async function exportToJson(quote: QuoteWithRelations): Promise<string> {
  // embed images as base64
  const sectionsWithBase64 = await Promise.all(
    quote.sections.map(async (section) => ({
      ...section,
      items: await Promise.all(
        section.items.map(async (item) => ({
          ...item,
          images: await Promise.all(
            item.images.map(async (img) => {
              let base64: string | undefined;
              try {
                const filePath = path.join(process.cwd(), "storage", "uploads", img.path.replace("/storage/uploads/", ""));
                const buf = fs.readFileSync(filePath);
                base64 = buf.toString("base64");
              } catch {
                base64 = undefined;
              }
              return { ...img, base64 };
            })
          ),
        }))
      ),
    }))
  );

  return JSON.stringify(
    { ...quote, sections: sectionsWithBase64, exportedAt: new Date().toISOString() },
    null,
    2
  );
}
