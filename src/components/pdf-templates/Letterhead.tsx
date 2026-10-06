import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/db/schema";

// Carta intestata comune a tutti i PDF (preventivi e comunicazioni):
// stessa intestazione, stesso piè di pagina, stessi colori.

export const PDF_PRIMARY = "#1e40af";
export const PDF_BORDER = "#e4e4e7";
export const PDF_MUTED = "#71717a";

export const letterheadStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#18181b",
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PDF_PRIMARY,
  },
  logo: { height: 44, maxWidth: 140, objectFit: "contain" },
  companyBlock: { flex: 1, paddingLeft: 10 },
  companyName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: PDF_PRIMARY,
    marginBottom: 2,
  },
  companyInfo: { fontSize: 8, color: PDF_MUTED, lineHeight: 1.4 },
  rightBlock: { alignItems: "flex-end" },
  code: { fontSize: 11, fontFamily: "Helvetica-Bold", color: PDF_PRIMARY },
  date: { fontSize: 8, color: PDF_MUTED, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: PDF_BORDER,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: PDF_MUTED },
});

export function companyData(settings: CompanySettings | null) {
  return {
    name: settings?.companyName || "Dieffe Ristrutturazioni",
    address: settings?.address ?? null,
    vatNumber: settings?.vatNumber ?? null,
    email: settings?.email ?? null,
    phone: settings?.phone ?? null,
    website: settings?.website ?? null,
  };
}

/** Intestazione: logo + dati azienda a sinistra, contenuto libero a destra. */
export function Letterhead({
  settings,
  logoUrl,
  children,
}: {
  settings: CompanySettings | null;
  logoUrl?: string | null;
  children?: React.ReactNode;
}) {
  const c = companyData(settings);
  const s = letterheadStyles;
  return (
    <View style={s.header}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
        {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
        <View style={[s.companyBlock, logoUrl ? {} : { paddingLeft: 0 }]}>
          <Text style={s.companyName}>{c.name}</Text>
          {c.address ? <Text style={s.companyInfo}>{c.address}</Text> : null}
          {c.vatNumber ? <Text style={s.companyInfo}>P.IVA {c.vatNumber}</Text> : null}
          {[c.email, c.phone, c.website].filter(Boolean).map((v, i) => (
            <Text key={i} style={s.companyInfo}>{v}</Text>
          ))}
        </View>
      </View>
      <View style={s.rightBlock}>{children}</View>
    </View>
  );
}

/** Piè di pagina fisso con ragione sociale e numero di pagina. */
export function LetterheadFooter({ settings }: { settings: CompanySettings | null }) {
  const c = companyData(settings);
  const s = letterheadStyles;
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        {c.name}
        {c.vatNumber ? ` — P.IVA ${c.vatNumber}` : ""}
      </Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`}
      />
    </View>
  );
}

/**
 * Timbro aziendale "composto": riquadro a doppio filo color inchiostro con
 * ragione sociale, indirizzo, P.IVA e contatti, come un timbro classico.
 */
export function CompanyStamp({ settings }: { settings: CompanySettings | null }) {
  const c = companyData(settings);
  const INK = "#1e3a8a";
  return (
    <View
      style={{
        borderWidth: 1.6,
        borderColor: INK,
        borderRadius: 6,
        padding: 2,
        opacity: 0.92,
      }}
    >
      <View
        style={{
          borderWidth: 0.6,
          borderColor: INK,
          borderRadius: 4,
          paddingVertical: 6,
          paddingHorizontal: 12,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Helvetica-Bold",
            fontSize: 10.5,
            color: INK,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {c.name}
        </Text>
        {c.address ? (
          <Text style={{ fontSize: 7, color: INK, marginTop: 2, textAlign: "center" }}>{c.address}</Text>
        ) : null}
        {c.vatNumber ? (
          <Text style={{ fontSize: 7, color: INK, marginTop: 1, fontFamily: "Helvetica-Bold", textAlign: "center" }}>
            P.IVA {c.vatNumber}
          </Text>
        ) : null}
        {c.email || c.phone ? (
          <Text style={{ fontSize: 7, color: INK, marginTop: 1, textAlign: "center" }}>
            {[c.phone ? `Tel. ${c.phone}` : null, c.email].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
