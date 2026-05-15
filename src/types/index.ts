import type {
  Quote,
  QuoteSection,
  QuoteItem,
  QuoteItemImage,
  QuoteSignature,
  Client,
  User,
} from "@/lib/db/schema";

export type QuoteWithRelations = Quote & {
  client: Client | null;
  sections: (QuoteSection & {
    items: (QuoteItem & { images: QuoteItemImage[] })[];
  })[];
  author: Pick<User, "id" | "name" | "email">;
  signature?: QuoteSignature | null;
};

export type SectionWithItems = QuoteSection & {
  items: (QuoteItem & { images: QuoteItemImage[] })[];
};

export type ItemWithImages = QuoteItem & { images: QuoteItemImage[] };

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "archived";

export type ExportFormat = "pdf" | "excel" | "csv" | "json";

export type TemplateData = {
  sections: {
    code: string;
    title: string;
    description?: string;
    items: {
      description: string;
      unitOfMeasure: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      notes?: string;
    }[];
  }[];
};

export type SessionUser = {
  user: Pick<User, "id" | "email" | "name" | "role" | "mustChangePassword">;
  session: { id: string; token: string; expiresAt: string };
};
