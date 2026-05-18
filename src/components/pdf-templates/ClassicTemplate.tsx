import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { QuoteWithRelations } from "@/types";
import type { CompanySettings } from "@/lib/db/schema";
import { calcQuoteTotals, calcSectionSubtotal } from "@/lib/calculations";
import { formatDate } from "@/lib/utils";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const PRIMARY = "#1e40af";
const SECTION_BG = "#dbeafe";
const OPTIONAL_BG = "#f3e8ff";
const OPTIONAL_BORDER = "#7c3aed";
const OPTIONAL_TEXT = "#5b21b6";
const OPTIONAL_HEADER_BG = "#6d28d9";
const ROW_ALT = "#f9fafb";
const BORDER = "#e4e4e7";
const MUTED = "#71717a";
const NOTE_COLOR = "#6b7280";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#18181b",
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 36,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  logo: { height: 44, maxWidth: 140, objectFit: "contain" },
  companyBlock: { flex: 1, paddingLeft: 10 },
  companyName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    marginBottom: 2,
  },
  companyInfo: { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  quoteInfo: { alignItems: "flex-end" },
  quoteCode: { fontSize: 11, fontFamily: "Helvetica-Bold", color: PRIMARY },
  quoteDate: { fontSize: 8, color: MUTED, marginTop: 2 },
  validityBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#fef9c3",
    borderRadius: 3,
  },
  validityText: { fontSize: 7, color: "#854d0e" },
  // ── Client ──────────────────────────────────────────────────────────────────
  clientBlock: {
    marginBottom: 14,
    padding: 10,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  clientLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.6,
  },
  clientName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  clientDetail: { fontSize: 8, color: MUTED, marginTop: 1 },
  // ── Title ───────────────────────────────────────────────────────────────────
  quoteTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  projectAddress: { fontSize: 8, color: MUTED, marginBottom: 14 },
  // ── Table header ────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 1,
  },
  thText: { color: "white", fontFamily: "Helvetica-Bold", fontSize: 8 },
  // ── Section row ─────────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    backgroundColor: SECTION_BG,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 1,
    borderRadius: 2,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: PRIMARY,
    flex: 1,
  },
  sectionSubtotal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: PRIMARY,
    width: 68,
    textAlign: "right",
  },
  // ── Section note ────────────────────────────────────────────────────────────
  sectionNote: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: NOTE_COLOR,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 4,
  },
  // ── Item row ────────────────────────────────────────────────────────────────
  itemRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  itemRowAlt: { backgroundColor: ROW_ALT },
  // columns
  colNum: { width: 28, fontSize: 8 },
  colDesc: { flex: 1, fontSize: 8, paddingRight: 4 },
  colUm: { width: 26, fontSize: 8, textAlign: "center" },
  colQty: { width: 34, fontSize: 8, textAlign: "right" },
  colPrice: { width: 52, fontSize: 8, textAlign: "right" },
  colDisc: { width: 28, fontSize: 8, textAlign: "right" },
  colTotal: {
    width: 62,
    fontSize: 8,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  // ── Item images ─────────────────────────────────────────────────────────────
  imagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: "#fafafa",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  imageBox: { alignItems: "center", width: 120 },
  itemImage: {
    width: 120,
    height: 80,
    objectFit: "cover",
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  imageCaption: {
    fontSize: 7,
    color: MUTED,
    marginTop: 2,
    textAlign: "center",
    maxWidth: 120,
  },
  // ── Totals ──────────────────────────────────────────────────────────────────
  totalsBox: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: 230,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: PRIMARY,
    borderRadius: 3,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "white",
  },
  grandTotalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "white",
  },
  // ── Optional table header ────────────────────────────────────────────────────
  optionalTableHeader: {
    flexDirection: "row",
    backgroundColor: OPTIONAL_HEADER_BG,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 1,
  },
  // ── Optional section ─────────────────────────────────────────────────────────
  optionalHeader: {
    marginTop: 20,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: OPTIONAL_BG,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: OPTIONAL_BORDER,
    borderBottomColor: OPTIONAL_BORDER,
    borderRadius: 2,
  },
  optionalHeaderText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: OPTIONAL_TEXT,
    textAlign: "center",
    letterSpacing: 1,
  },
  optionalSectionRow: {
    flexDirection: "row",
    backgroundColor: OPTIONAL_BG,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 1,
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: OPTIONAL_BORDER,
  },
  optionalSectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: OPTIONAL_TEXT,
    flex: 1,
  },
  optionalSectionSubtotal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: OPTIONAL_TEXT,
    width: 68,
    textAlign: "right",
  },
  optionalIncludedNote: {
    fontSize: 7,
    color: OPTIONAL_TEXT,
    fontFamily: "Helvetica-Oblique",
    marginLeft: 4,
  },
  optionalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: OPTIONAL_BG,
    borderWidth: 1,
    borderColor: OPTIONAL_BORDER,
    borderRadius: 3,
    marginTop: 8,
    alignSelf: "flex-end",
    width: 230,
  },
  optionalTotalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: OPTIONAL_TEXT,
  },
  optionalTotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: OPTIONAL_TEXT,
  },
  // ── Payment / notes ──────────────────────────────────────────────────────────
  paymentBox: {
    marginTop: 18,
    padding: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  bodyText: { fontSize: 8, lineHeight: 1.5 },
  notesBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: ROW_ALT,
    borderRadius: 3,
  },
  // ── Signature ────────────────────────────────────────────────────────────────
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 20,
  },
  signatureBox: { flex: 1 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#a1a1aa",
    marginTop: 20,
    marginBottom: 3,
  },
  signatureLabel: { fontSize: 7, color: MUTED, textAlign: "center" },
  // ── Digital signature section ─────────────────────────────────────────────────
  digitalSigSection: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
  },
  digitalSigTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: MUTED,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  digitalSigRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  digitalSigLabel: { fontSize: 8, color: MUTED, width: 100 },
  digitalSigValue: { fontSize: 8, flex: 1 },
  digitalSigImage: { width: 200, height: 60, objectFit: "contain", marginTop: 6, borderWidth: 0.5, borderColor: BORDER, borderRadius: 2 },
  digitalSigNote: { fontSize: 7, color: MUTED, marginTop: 8, fontFamily: "Helvetica-Oblique" },
  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: MUTED },
});

// ─── Props ────────────────────────────────────────────────────────────────────

type DigitalSignature = {
  signerName: string;
  signatureDataUrl: string;
  signedAt: Date | string;
  ipAddress: string | null;
  action: "accepted" | "rejected";
};

export interface ClassicTemplateProps {
  quote: QuoteWithRelations & { signature?: DigitalSignature | null };
  settings: CompanySettings | null;
  logoUrl?: string | null;
}

// ─── Section rows renderer ────────────────────────────────────────────────────

function SectionRows({
  section,
  isOptional,
}: {
  section: QuoteWithRelations["sections"][number];
  isOptional: boolean;
}) {
  const rowStyle = isOptional ? s.optionalSectionRow : s.sectionRow;
  const titleStyle = isOptional ? s.optionalSectionTitle : s.sectionTitle;
  const subtotalStyle = isOptional ? s.optionalSectionSubtotal : s.sectionSubtotal;
  const includedNote =
    isOptional && section.isOptionalIncluded ? "(incluso nel totale)" : null;

  return (
    <View>
      <View style={rowStyle}>
        <Text style={titleStyle}>
          {section.code} — {section.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {includedNote ? (
            <Text style={s.optionalIncludedNote}>{includedNote}</Text>
          ) : null}
          <Text style={subtotalStyle}>
            {fmtCurrency(calcSectionSubtotal(section.items))}
          </Text>
        </View>
      </View>

      {section.sectionNote ? (
        <Text style={s.sectionNote}>{section.sectionNote}</Text>
      ) : null}

      {section.items.map((item, iIdx) => {
        const hasImages = item.images.length > 0;
        return (
          <View key={item.id}>
            <View style={[s.itemRow, iIdx % 2 === 1 ? s.itemRowAlt : {}]}>
              <Text style={s.colNum}>
                {section.code}.{iIdx + 1}
              </Text>
              <Text style={s.colDesc}>{item.description}</Text>
              <Text style={s.colUm}>{item.unitOfMeasure}</Text>
              <Text style={s.colQty}>{fmtNum(item.quantity)}</Text>
              <Text style={s.colPrice}>{fmtCurrency(item.unitPrice)}</Text>
              <Text style={s.colDisc}>
                {item.discount > 0 ? `${item.discount}%` : "—"}
              </Text>
              <Text style={s.colTotal}>{fmtCurrency(item.total)}</Text>
            </View>

            {hasImages && (
              <View style={s.imagesRow}>
                {item.images.map((img) => {
                  const src = img.cloudinaryUrl.replace(
                    "/upload/",
                    "/upload/f_auto,q_auto,w_800/"
                  );
                  return (
                    <View key={img.id} style={s.imageBox}>
                      <Image src={src} style={s.itemImage} />
                      {img.caption ? (
                        <Text style={s.imageCaption}>{img.caption}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClassicTemplate({ quote, settings, logoUrl }: ClassicTemplateProps) {
  const { signature } = quote as { signature?: DigitalSignature | null };
  const totals = calcQuoteTotals(
    quote.sections,
    quote.vatRate,
    quote.discountType,
    quote.discountValue
  );

  const normalSections = quote.sections.filter((s) => !s.isOptional);
  const optionalSections = quote.sections.filter((s) => !!s.isOptional);
  const hasOptional = optionalSections.length > 0;

  // optional sections NOT included in main total
  const optionalExcludedSubtotal = totals.optionalSections
    .filter((s) => !s.isIncluded)
    .reduce((sum, s) => sum + s.subtotal, 0);

  const companyName = settings?.companyName ?? "Dieffe Ristrutturazioni";
  const address = settings?.address;
  const vatNum = settings?.vatNumber;
  const email = settings?.email;
  const phone = settings?.phone;
  const website = settings?.website;

  return (
    <Document title={`${quote.code} — ${quote.title}`} author={companyName}>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
            {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
            <View style={[s.companyBlock, logoUrl ? {} : { paddingLeft: 0 }]}>
              <Text style={s.companyName}>{companyName}</Text>
              {address ? <Text style={s.companyInfo}>{address}</Text> : null}
              {vatNum ? <Text style={s.companyInfo}>P.IVA {vatNum}</Text> : null}
              {[email, phone, website].filter(Boolean).map((v, i) => (
                <Text key={i} style={s.companyInfo}>{v}</Text>
              ))}
            </View>
          </View>
          <View style={s.quoteInfo}>
            <Text style={s.quoteCode}>{quote.code}</Text>
            <Text style={s.quoteDate}>Data: {formatDate(quote.createdAt)}</Text>
            {quote.validUntil && (
              <View style={s.validityBadge}>
                <Text style={s.validityText}>
                  Valido fino al {formatDate(quote.validUntil)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Client ── */}
        {quote.client && (
          <View style={s.clientBlock}>
            <Text style={s.clientLabel}>Destinatario</Text>
            <Text style={s.clientName}>{quote.client.name}</Text>
            {quote.client.address ? (
              <Text style={s.clientDetail}>{quote.client.address}</Text>
            ) : null}
            {quote.client.vatNumber ? (
              <Text style={s.clientDetail}>P.IVA {quote.client.vatNumber}</Text>
            ) : null}
            {quote.client.email ? (
              <Text style={s.clientDetail}>{quote.client.email}</Text>
            ) : null}
          </View>
        )}

        {/* ── Title ── */}
        <Text style={s.quoteTitle}>{quote.title}</Text>
        {quote.projectAddress ? (
          <Text style={s.projectAddress}>Cantiere: {quote.projectAddress}</Text>
        ) : null}

        {/* ── Table header ── */}
        <View style={s.tableHeader}>
          <Text style={[s.thText, s.colNum]}>N.</Text>
          <Text style={[s.thText, s.colDesc]}>Descrizione</Text>
          <Text style={[s.thText, s.colUm]}>U.M.</Text>
          <Text style={[s.thText, s.colQty]}>Qtà</Text>
          <Text style={[s.thText, s.colPrice]}>Prezzo</Text>
          <Text style={[s.thText, s.colDisc]}>Sc.%</Text>
          <Text style={[s.thText, s.colTotal]}>Totale</Text>
        </View>

        {/* ── Normal sections & items ── */}
        {normalSections.map((section) => (
          <SectionRows key={section.id} section={section} isOptional={false} />
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsBox}>
          {hasOptional && totals.baseSubtotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotale sezioni principali</Text>
              <Text style={s.totalValue}>{fmtCurrency(totals.baseSubtotal)}</Text>
            </View>
          )}
          {totals.optionalIncludedSubtotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>+ Opzionali incluse</Text>
              <Text style={s.totalValue}>{fmtCurrency(totals.optionalIncludedSubtotal)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotale</Text>
            <Text style={s.totalValue}>{fmtCurrency(totals.subtotalBeforeDiscount)}</Text>
          </View>
          {totals.discountAmount > 0 && (
            <>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Sconto</Text>
                <Text style={[s.totalValue, { color: "#ef4444" }]}>
                  -{fmtCurrency(totals.discountAmount)}
                </Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Imponibile</Text>
                <Text style={s.totalValue}>{fmtCurrency(totals.taxableAmount)}</Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>IVA {quote.vatRate}%</Text>
            <Text style={s.totalValue}>{fmtCurrency(totals.vatAmount)}</Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>TOTALE</Text>
            <Text style={s.grandTotalValue}>{fmtCurrency(totals.total)}</Text>
          </View>
        </View>

        {/* ── Optional sections ── */}
        {hasOptional && (
          <>
            <View style={s.optionalHeader}>
              <Text style={s.optionalHeaderText}>PARTE OPZIONALE</Text>
            </View>

            <View style={s.optionalTableHeader}>
              <Text style={[s.thText, s.colNum]}>N.</Text>
              <Text style={[s.thText, s.colDesc]}>Descrizione</Text>
              <Text style={[s.thText, s.colUm]}>U.M.</Text>
              <Text style={[s.thText, s.colQty]}>Qtà</Text>
              <Text style={[s.thText, s.colPrice]}>Prezzo</Text>
              <Text style={[s.thText, s.colDisc]}>Sc.%</Text>
              <Text style={[s.thText, s.colTotal]}>Totale</Text>
            </View>

            {optionalSections.map((section) => (
              <SectionRows key={section.id} section={section} isOptional={true} />
            ))}

            {optionalExcludedSubtotal > 0 && (
              <View style={s.optionalTotalRow}>
                <Text style={s.optionalTotalLabel}>TOTALE PARTE OPZIONALE</Text>
                <Text style={s.optionalTotalValue}>
                  {fmtCurrency(optionalExcludedSubtotal)}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Payment terms ── */}
        {quote.paymentTerms ? (
          <View style={s.paymentBox}>
            <Text style={s.sectionLabel}>Condizioni di pagamento</Text>
            <Text style={s.bodyText}>{quote.paymentTerms}</Text>
          </View>
        ) : null}

        {/* ── Notes ── */}
        {quote.notes ? (
          <View style={s.notesBox}>
            <Text style={s.sectionLabel}>Note</Text>
            <Text style={s.bodyText}>{quote.notes}</Text>
          </View>
        ) : null}

        {/* ── Digital signature (if present) ── */}
        {signature && (
          <View style={s.digitalSigSection}>
            <Text style={s.digitalSigTitle}>Firma di accettazione</Text>
            <View style={s.digitalSigRow}>
              <Text style={s.digitalSigLabel}>
                {signature.action === "accepted" ? "Accettato da:" : "Rifiutato da:"}
              </Text>
              <Text style={s.digitalSigValue}>{signature.signerName}</Text>
            </View>
            <View style={s.digitalSigRow}>
              <Text style={s.digitalSigLabel}>Data e ora:</Text>
              <Text style={s.digitalSigValue}>{formatDate(String(signature.signedAt))}</Text>
            </View>
            {signature.ipAddress ? (
              <View style={s.digitalSigRow}>
                <Text style={s.digitalSigLabel}>IP:</Text>
                <Text style={s.digitalSigValue}>{signature.ipAddress}</Text>
              </View>
            ) : null}
            {signature.action === "accepted" && signature.signatureDataUrl ? (
              <Image src={signature.signatureDataUrl} style={s.digitalSigImage} />
            ) : null}
            <Text style={s.digitalSigNote}>
              Documento firmato elettronicamente con consenso esplicito alla registrazione IP tramite dieffe-preventivi.vercel.app
            </Text>
          </View>
        )}

        {/* ── Signature blocks — solo se nessuna firma digitale presente ── */}
        {!signature && (
          <View style={s.signatureRow}>
            <View style={s.signatureBox}>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>Firma e timbro {companyName}</Text>
            </View>
            <View style={s.signatureBox}>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>
                Firma per accettazione — {quote.client?.name ?? "Cliente"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {companyName}
            {vatNum ? ` — P.IVA ${vatNum}` : ""}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
