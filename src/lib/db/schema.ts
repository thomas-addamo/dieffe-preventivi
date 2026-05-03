import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(true),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastLoginAt: text("last_login_at"),
});

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Company Settings ─────────────────────────────────────────────────────────

export const companySettings = sqliteTable("company_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull().default(""),
  logoPath: text("logo_path"),
  address: text("address"),
  vatNumber: text("vat_number"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  defaultVatRate: real("default_vat_rate").notNull().default(22),
  defaultExportPath: text("default_export_path"),
  pdfTemplate: text("pdf_template", {
    enum: ["classic", "modern", "minimal"],
  })
    .notNull()
    .default("classic"),
  primaryColor: text("primary_color").notNull().default("#1e40af"),
  accentColor: text("accent_color").notNull().default("#059669"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  vatNumber: text("vat_number"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const quotes = sqliteTable(
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
    vatRate: real("vat_rate").notNull().default(22),
    discountType: text("discount_type", { enum: ["percent", "fixed"] }),
    discountValue: real("discount_value"),
    notes: text("notes"),
    paymentTerms: text("payment_terms"),
    validUntil: text("valid_until"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    sentAt: text("sent_at"),
  },
  (t) => [
    uniqueIndex("quotes_code_idx").on(t.code),
    index("quotes_user_id_idx").on(t.userId),
    index("quotes_client_id_idx").on(t.clientId),
  ]
);

// ─── Quote Year Counters ──────────────────────────────────────────────────────

export const quoteYearCounters = sqliteTable("quote_year_counters", {
  year: integer("year").primaryKey(),
  counter: integer("counter").notNull().default(0),
});

// ─── Quote Sections ───────────────────────────────────────────────────────────

export const quoteSections = sqliteTable(
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

export const quoteItems = sqliteTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id")
      .notNull()
      .references(() => quoteSections.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    unitOfMeasure: text("unit_of_measure").notNull().default("n°"),
    quantity: real("quantity").notNull().default(1),
    unitPrice: real("unit_price").notNull().default(0),
    discount: real("discount").notNull().default(0),
    total: real("total").notNull().default(0),
    notes: text("notes"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("quote_items_section_id_idx").on(t.sectionId)]
);

// ─── Quote Item Images ────────────────────────────────────────────────────────

export const quoteItemImages = sqliteTable("quote_item_images", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => quoteItems.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  caption: text("caption"),
  orderIndex: integer("order_index").notNull().default(0),
});

// ─── Quote Templates ──────────────────────────────────────────────────────────

export const quoteTemplates = sqliteTable("quote_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  data: text("data", { mode: "json" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  changes: text("changes", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
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
