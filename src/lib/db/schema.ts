import {
  pgTable,
  text,
  integer,
  boolean,
  doublePrecision,
  numeric,
  serial,
  jsonb,
  index,
  uniqueIndex,
  timestamp,
  date,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("editor"),
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
  isImpersonated: boolean("is_impersonated").notNull().default(false),
  impersonatedBy: text("impersonated_by").references(() => users.id, { onDelete: "set null" }),
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
  emailFromAddress: text("email_from_address").default("onboarding@resend.dev"),
  quotePrefix: text("quote_prefix").notNull().default("PREV"),
  // ── Controlli amministratore (org-wide) ──────────────────────────────────
  // Notifica tutto il team quando un preventivo viene accettato / rifiutato.
  notifyTeamOnAccept: boolean("notify_team_on_accept").notNull().default(true),
  notifyTeamOnReject: boolean("notify_team_on_reject").notNull().default(false),
  // Valori predefiniti applicati ai nuovi preventivi (se non specificati).
  defaultPaymentTerms: text("default_payment_terms"),
  defaultQuoteNotes: text("default_quote_notes"),
  // Interruttore generale dell'AI per tutto il team.
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  // Riordino automatico del listino: le voci non usate da più di N mesi
  // vengono eliminate (salvo quelle fissate).
  priceListRetentionMonths: integer("price_list_retention_months").notNull().default(12),
  priceListMaintainedAt: timestamp("price_list_maintained_at", { withTimezone: true, mode: "string" }),
  priceListMaintenanceReport: jsonb("price_list_maintenance_report"),
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
    publicToken: text("public_token").unique(),
    publicTokenExpiresAt: timestamp("public_token_expires_at", { withTimezone: true }),
    publicTokenDays: integer("public_token_days").default(30),
    publicPin: text("public_pin"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedBy: text("locked_by").references(() => users.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    /** standard | extra — un "lavoro extra" è un preventivo separato di sole
     *  lavorazioni aggiuntive, legato al preventivo principale. */
    kind: text("kind", { enum: ["standard", "extra"] }).notNull().default("standard"),
    parentQuoteId: text("parent_quote_id").references((): AnyPgColumn => quotes.id, {
      onDelete: "set null",
    }),
    /** Cantiere a cui appartiene il preventivo (principale o lavoro extra). */
    siteId: text("site_id").references((): AnyPgColumn => sites.id, { onDelete: "set null" }),
    /** Fasi e SAL di questo preventivo già generati nel cantiere. */
    siteSetupAt: timestamp("site_setup_at", { withTimezone: true }),
    /** Lavori conclusi: il cantiere è stato chiuso ed eliminato, il
     *  preventivo resta e non genera più un cantiere. */
    worksCompletedAt: timestamp("works_completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("quotes_code_idx").on(t.code),
    index("quotes_user_id_idx").on(t.userId),
    index("quotes_client_id_idx").on(t.clientId),
    index("quotes_parent_id_idx").on(t.parentQuoteId),
    index("quotes_site_id_idx").on(t.siteId),
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
    sectionNote: text("section_note"),
    isOptional: boolean("is_optional").notNull().default(false),
    isOptionalIncluded: boolean("is_optional_included").notNull().default(false),
    // Prezzo a corpo di sezione: quando attivo, il subtotale della sezione è
    // lumpSumPrice e i totali delle singole voci non concorrono al totale.
    lumpSum: boolean("lump_sum").notNull().default(false),
    lumpSumPrice: doublePrecision("lump_sum_price"),
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

// ─── Communications (lettere / comunicazioni su carta intestata) ───────────────

export type CommunicationRecipient = {
  /** cliente | condomini | amministratore | architetto | altro */
  kind: string;
  /** Formula di apertura: "Spett.le", "Egr. Arch.", "Gent.mi Condòmini"… */
  salutation: string;
  name: string;
  address?: string;
  email?: string;
  clientId?: string | null;
};

export const communications = pgTable(
  "communications",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    subject: text("subject").notNull().default(""),
    /** Documento Tiptap (JSON ProseMirror) con la formattazione completa. */
    body: jsonb("body").notNull(),
    recipients: jsonb("recipients").$type<CommunicationRecipient[]>().notNull().default([]),
    place: text("place"),
    documentDate: text("document_date"),
    includeStamp: boolean("include_stamp").notNull().default(true),
    signatory: text("signatory"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("communications_code_idx").on(t.code)]
);

// ─── Quote Signatures ─────────────────────────────────────────────────────────

export const quoteSignatures = pgTable("quote_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull().default(""),
  signatureDataUrl: text("signature_data_url").notNull(),
  ipAddress: text("ip_address"),
  ipConsent: boolean("ip_consent").notNull().default(false),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
  action: text("action", { enum: ["accepted", "rejected"] }).notNull(),
  privacyConsent: boolean("privacy_consent").notNull().default(false),
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

// ─── User Access Log ──────────────────────────────────────────────────────────

export const userAccessLog = pgTable("user_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  loginAt: timestamp("login_at", { withTimezone: true, mode: "string" }).defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
});

// ─── Price List Items ─────────────────────────────────────────────────────────

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code"),
    description: text("description").notNull(),
    unitOfMeasure: text("unit_of_measure").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    /** Macro-categoria del catalogo (vedi lib/price-list/taxonomy). */
    category: text("category"),
    /** Secondo livello della gerarchia (es. Pavimenti › Gres porcellanato). */
    subcategory: text("subcategory"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    /** Voce fissata: il riordino automatico non la elimina né la unisce. */
    pinned: boolean("pinned").default(false).notNull(),
    /** manual | learned | import — da dove arriva la voce. */
    source: text("source").default("manual").notNull(),
    /** Ultima volta che la voce è comparsa in un preventivo. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    usageCount: integer("usage_count").default(0).notNull(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("price_list_description_idx").on(t.description),
    index("price_list_category_idx").on(t.category, t.subcategory),
  ]
);

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: [
        "quote_signed",
        "quote_rejected",
        "quote_status",
        "quote_assigned",
        "quote_locked",
        "quote_unlocked",
        "quote_deleted",
        "system",
        // Tipi creabili manualmente dall'admin (broadcast / comunicazioni)
        "feature",
        "announcement",
        "maintenance",
        "alert",
        // Richiesta d'aiuto inviata da un utente agli amministratori
        "support",
        // Gestione cantieri: SAL da fatturare, eventi in calendario
        "site",
      ],
    })
      .notNull()
      .default("system"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_user_read_idx").on(t.userId, t.readAt),
  ]
);

// ─── Push Subscriptions (Web Push nativo) ──────────────────────────────────────

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // endpoint univoco fornito dal browser/push service
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint),
    index("push_subscriptions_user_id_idx").on(t.userId),
  ]
);

// ─── Cantieri (v4) ────────────────────────────────────────────────────────────
//
// Un cantiere nasce da solo dal preventivo principale inviato (in attesa) o
// accettato (attivo) e raccoglie anche i suoi lavori extra. Quando i lavori
// sono conclusi il cantiere viene ELIMINATO con tutto ciò che contiene (fasi,
// SAL, eventi, note: ON DELETE CASCADE); i preventivi restano.
// Struttura pensata per un DB leggero: importi e avanzamento si calcolano dai
// preventivi (niente copie), i consigli IA stanno in una colonna del cantiere.

export const sites = pgTable(
  "sites",
  {
    id: text("id").primaryKey(),
    /** pending = preventivo inviato · active = preventivo accettato */
    status: text("status", { enum: ["pending", "active"] }).notNull().default("pending"),
    mainQuoteId: text("main_quote_id")
      .notNull()
      .references((): AnyPgColumn => quotes.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** pending → da cercare · ok · failed (indirizzo non trovato) · manual */
    geoStatus: text("geo_status", { enum: ["pending", "ok", "failed", "manual"] })
      .notNull()
      .default("pending"),
    startDate: date("start_date"),
    plannedEndDate: date("planned_end_date"),
    /** Costo di un giorno di cantiere (squadra, noli, suolo pubblico) in €. */
    dailyCost: doublePrecision("daily_cost"),
    /** Penale contrattuale per giorno di ritardo in €. */
    penaltyPerDay: doublePrecision("penalty_per_day"),
    /** Margine atteso sull'imponibile, in %. */
    marginPct: doublePrecision("margin_pct").notNull().default(20),
    /** Avanzamento 0–100, ricalcolato a ogni modifica delle fasi. */
    progress: doublePrecision("progress").notNull().default(0),
    /** Consigli IA in cache: rigenerati solo se i dati cambiano. */
    aiInsights: jsonb("ai_insights"),
    aiInsightsHash: text("ai_insights_hash"),
    aiInsightsAt: timestamp("ai_insights_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sites_main_quote_idx").on(t.mainQuoteId)]
);

export const sitePhases = pgTable(
  "site_phases",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    /** Preventivo da cui deriva la fase (null = aggiunta a mano). */
    quoteId: text("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Peso nell'avanzamento: l'importo delle lavorazioni (€). */
    weight: doublePrecision("weight").notNull().default(0),
    orderIndex: integer("order_index").notNull().default(0),
    durationDays: integer("duration_days"),
    plannedStart: date("planned_start"),
    plannedEnd: date("planned_end"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    note: text("note"),
    source: text("source", { enum: ["ai", "manual"] }).notNull().default("manual"),
  },
  (t) => [index("site_phases_site_idx").on(t.siteId)]
);

export const siteMilestones = pgTable(
  "site_milestones",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    quoteId: text("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** Percentuale dell'imponibile del preventivo… */
    percent: doublePrecision("percent"),
    /** …oppure importo fisso (es. "acconto 500 €"). */
    amount: doublePrecision("amount"),
    /** accept = all'accettazione · start = a inizio lavori · phase = a fine
     *  fase · end = a fine lavori · manual = lo segna l'utente */
    trigger: text("trigger", { enum: ["accept", "start", "phase", "end", "manual"] })
      .notNull()
      .default("manual"),
    phaseId: text("phase_id").references(() => sitePhases.id, { onDelete: "set null" }),
    orderIndex: integer("order_index").notNull().default(0),
    reachedAt: timestamp("reached_at", { withTimezone: true }),
    invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
    invoiceNumber: text("invoice_number"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("site_milestones_site_idx").on(t.siteId)]
);

export const SITE_EVENT_TYPES = [
  "suolo_pubblico",
  "intervento",
  "consegna",
  "sopralluogo",
  "scadenza",
  "altro",
] as const;

export const siteEvents = pgTable(
  "site_events",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    endDate: date("end_date"),
    type: text("type", { enum: SITE_EVENT_TYPES }).notNull().default("altro"),
    title: text("title").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("site_events_site_date_idx").on(t.siteId, t.date)]
);

export const siteNotes = pgTable(
  "site_notes",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("site_notes_site_idx").on(t.siteId)]
);

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
export type Communication = typeof communications.$inferSelect;
export type QuoteSignature = typeof quoteSignatures.$inferSelect;
export type NewQuoteSignature = typeof quoteSignatures.$inferInsert;
export type UserAccessLog = typeof userAccessLog.$inferSelect;
export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type SitePhase = typeof sitePhases.$inferSelect;
export type SiteMilestone = typeof siteMilestones.$inferSelect;
export type SiteEvent = typeof siteEvents.$inferSelect;
export type SiteNote = typeof siteNotes.$inferSelect;
