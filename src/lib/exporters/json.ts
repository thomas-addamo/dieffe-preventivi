import type { QuoteWithRelations } from "@/types";

export async function exportToJson(quote: QuoteWithRelations): Promise<string> {
  // embed images as base64 fetching from Cloudinary
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
                const res = await fetch(img.cloudinaryUrl);
                if (res.ok) {
                  const buf = await res.arrayBuffer();
                  base64 = Buffer.from(buf).toString("base64");
                }
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
    {
      ...quote,
      sections: sectionsWithBase64,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}
