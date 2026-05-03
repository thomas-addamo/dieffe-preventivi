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
const ROW_ALT = "#f9fafb";
const BORDER = "#e4e4e7";
const MUTED = "#71717a";

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

export interface ClassicTemplateProps {
  quote: QuoteWithRelations;
  settings: CompanySettings | null;
  /** Absolute file-system path to the logo file (passed by the server route). */
  logoAbsPath?: string | null;
  /**
   * Map of image id → absolute file-system path.
   * Populated by the server route so react-pdf can read local files.
   */
  imageAbsPaths?: Record<string, string>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClassicTemplate({
  quote,
  settings,
  logoAbsPath,
  imageAbsPaths = {},
}: ClassicTemplateProps) {
  const totals = calcQuoteTotals(
    quote.sections,
    quote.vatRate,
    quote.discountType,
    quote.discountValue
  );

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
          {/* Left: logo + company info */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
            {logoAbsPath ? (
              <Image src={logoAbsPath} style={s.logo} />
            ) : null}
            <View style={[s.companyBlock, logoAbsPath ? {} : { paddingLeft: 0 }]}>
              <Text style={s.companyName}>{companyName}</Text>
              {address ? <Text style={s.companyInfo}>{address}</Text> : null}
              {vatNum ? (
                <Text style={s.companyInfo}>P.IVA {vatNum}</Text>
              ) : null}
              {[email, phone, website]
                .filter(Boolean)
                .map((v, i) => (
                  <Text key={i} style={s.companyInfo}>
                    {v}
                  </Text>
                ))}
            </View>
          </View>

          {/* Right: quote ref */}
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
              <Text style={s.clientDetail}>
                P.IVA {quote.client.vatNumber}
              </Text>
            ) : null}
            {quote.client.email ? (
              <Text style={s.clientDetail}>{quote.client.email}</Text>
            ) : null}
          </View>
        )}

        {/* ── Title ── */}
        <Text style={s.quoteTitle}>{quote.title}</Text>
        {quote.projectAddress ? (
          <Text style={s.projectAddress}>
            Cantiere: {quote.projectAddress}
          </Text>
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

        {/* ── Sections & items ── */}
        {quote.sections.map((section) => (
          <View key={section.id}>
            {/* Section heading */}
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>
                {section.code} — {section.title}
              </Text>
              <Text style={s.sectionSubtotal}>
                {fmtCurrency(calcSectionSubtotal(section.items))}
              </Text>
            </View>

            {/* Items */}
            {section.items.map((item, iIdx) => {
              const hasImages = item.images.length > 0;
              return (
                <View key={item.id}>
                  {/* Item row */}
                  <View
                    style={[s.itemRow, iIdx % 2 === 1 ? s.itemRowAlt : {}]}
                  >
                    <Text style={s.colNum}>
                      {section.code}.{iIdx + 1}
                    </Text>
                    <Text style={s.colDesc}>{item.description}</Text>
                    <Text style={s.colUm}>{item.unitOfMeasure}</Text>
                    <Text style={s.colQty}>{fmtNum(item.quantity)}</Text>
                    <Text style={s.colPrice}>
                      {fmtCurrency(item.unitPrice)}
                    </Text>
                    <Text style={s.colDisc}>
                      {item.discount > 0 ? `${item.discount}%` : "—"}
                    </Text>
                    <Text style={s.colTotal}>{fmtCurrency(item.total)}</Text>
                  </View>

                  {/* Images row (only when images exist and path resolved) */}
                  {hasImages && (
                    <View style={s.imagesRow}>
                      {item.images.map((img) => {
                        const absPath = imageAbsPaths[img.id];
                        if (!absPath) return null;
                        return (
                          <View key={img.id} style={s.imageBox}>
                            <Image src={absPath} style={s.itemImage} />
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
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotale</Text>
            <Text style={s.totalValue}>{fmtCurrency(totals.subtotal)}</Text>
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
                <Text style={s.totalValue}>
                  {fmtCurrency(totals.taxableAmount)}
                </Text>
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

        {/* ── Signature blocks ── */}
        <View style={s.signatureRow}>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>
              Firma e timbro {companyName}
            </Text>
          </View>
          <View style={s.signatureBox}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>
              Firma per accettazione — {quote.client?.name ?? "Cliente"}
            </Text>
          </View>
        </View>

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
