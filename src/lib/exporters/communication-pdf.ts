import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db/client";
import { companySettings, type Communication } from "@/lib/db/schema";
import { cloudinary } from "@/lib/cloudinary";
import { CommunicationTemplate } from "@/components/pdf-templates/CommunicationTemplate";

/** PDF di una comunicazione, con la stessa carta intestata dei preventivi. */
export async function generateCommunicationPdfBuffer(communication: Communication): Promise<Buffer> {
  const [settings] = await db.select().from(companySettings).limit(1);
  const s = settings ?? null;

  const logoUrl = s?.logoPath
    ? cloudinary.url(s.logoPath, {
        fetch_format: "auto",
        quality: "auto",
        width: 280,
        crop: "limit",
        secure: true,
      })
    : null;

  const element = React.createElement(CommunicationTemplate, {
    communication,
    settings: s,
    logoUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await renderToBuffer(element as any)) as unknown as Buffer;
}
