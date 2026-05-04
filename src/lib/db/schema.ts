import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  serial,
  jsonb,
  index,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp("last_login_at", {
    withTimezone: true,
    mode: "string",
  }),
});

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Company Settings ─────────────────────────────────────────────────────────

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  logoPath: text("logo_path"),
  address: text("address"),
  vatNumber: text("vat_number"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  defaultVatRate: doublePrecision("default_vat_rate").notNull().default(22),
  defaultExportPath: text("default_export_path"),
  pdfTemplate: text("pdf_template", {
    enum: ["classic", "modern", "minimal"],
  })
    .notNull()
    .default("classic"),
  primaryColor: text("primary_color").notNull().default("#1e40af"),
  accentColor: text("accent_color").notNull().default("#059669"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  vatNumber: text("vat_number"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["draft", "sent", "accepted", "rejected", "archived"],
    })
      .notNull()
      .default("draft"),
    projectAddress: text("project_address"),
    vatRate: doublePrecision("vat_rate").notNull().default(22),
    discountType: text("discount_type", { enum: ["percent", "fixed"] }),
    discountValue: doublePrecision("discount_value"),
    notes: text("notes"),
    paymentTerms: text("payment_terms"),
    validUntil: text("valid_until"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    uniqueIndex("quotes_code_idx").on(t.code),
    index("quotes_user_id_idx").on(t.userId),
    index("quotes_client_id_idx").on(t.clientId),
  ]
);

// ─── Quote Year Counters ──────────────────────────────────────────────────────

export const quoteYearCounters = pgTable("quote_year_counters", {
  year: integer("year").primaryKey(),
  counter: integer("counter").notNull().default(0),
});

// ─── Quote Sections ───────────────────────────────────────────────────────────

export const quoteSections = pgTable(
  "quote_sections",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("quote_sections_quote_id_idx").on(t.quoteId)]
);

// ─── Quote Items ──────────────────────────────────────────────────────────────

export const quoteItems = pgTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id")
      .notNull()
      .references(() => quoteSections.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    unitOfMeasure: text("unit_of_measure").notNull().default("n°"),
    quantity: doublePrecision("quantity").notNull().default(1),
    unitPrice: doublePrecision("unit_price").notNull().default(0),
    discount: doublePrecision("discount").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    notes: text("notes"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("quote_items_section_id_idx").on(t.sectionId)]
);

// ─── Quote Item Images ────────────────────────────────────────────────────────

export const quoteItemImages = pgTable("quote_item_images", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => quoteItems.id, { onDelete: "cascade" }),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  cloudinaryUrl: text("cloudinary_url").notNull(),
  caption: text("caption"),
  orderIndex: integer("order_index").notNull().default(0),
});

// ─── Quote Templates ──────────────────────────────────────────────────────────

export const quoteTemplates = pgTable("quote_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  data: jsonb("data").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteSection = typeof quoteSections.$inferSelect;
export type NewQuoteSection = typeof quoteSections.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
export type QuoteItemImage = typeof quoteItemImages.$inferSelect;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;
