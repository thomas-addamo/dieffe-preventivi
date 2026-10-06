import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Communication, CompanySettings } from "@/lib/db/schema";
import type { PMNode } from "@/lib/communications";
import { formatDate } from "@/lib/utils";
import {
  CompanyStamp,
  Letterhead,
  LetterheadFooter,
  PDF_MUTED,
  PDF_PRIMARY,
  companyData,
  letterheadStyles,
} from "./Letterhead";
import { PdfDocBody } from "./PdfDocBody";

// Comunicazione su carta intestata: stessa intestazione dei preventivi,
// destinatari, oggetto, corpo formattato e timbro aziendale in calce.

function longDate(iso: string | null | undefined): string {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return formatDate(new Date().toISOString());
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function CommunicationTemplate({
  communication: c,
  settings,
  logoUrl,
}: {
  communication: Communication;
  settings: CompanySettings | null;
  logoUrl?: string | null;
}) {
  const company = companyData(settings);
  const recipients = (c.recipients ?? []).filter((r) => r.name?.trim() || r.salutation?.trim());
  const dateLine = [c.place?.trim(), longDate(c.documentDate)].filter(Boolean).join(", ");

  return (
    <Document title={c.subject ? `${c.code} — ${c.subject}` : c.code} author={company.name}>
      <Page size="A4" style={letterheadStyles.page}>
        <Letterhead settings={settings} logoUrl={logoUrl}>
          <Text style={letterheadStyles.code}>{c.code}</Text>
          <Text style={letterheadStyles.date}>Comunicazione</Text>
        </Letterhead>

        {/* Luogo e data */}
        <Text style={{ fontSize: 9.5, textAlign: "right", marginBottom: 14 }}>{dateLine}</Text>

        {/* Destinatari: blocco a destra, come nelle lettere commerciali */}
        {recipients.length > 0 && (
          <View style={{ alignItems: "flex-end", marginBottom: 18 }}>
            <View style={{ width: 240 }}>
              {recipients.map((r, i) => (
                <View key={i} style={{ marginBottom: i === recipients.length - 1 ? 0 : 8 }}>
                  {r.salutation ? (
                    <Text style={{ fontSize: 9.5, color: PDF_MUTED }}>{r.salutation}</Text>
                  ) : null}
                  {r.name ? (
                    <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold" }}>{r.name}</Text>
                  ) : null}
                  {r.address
                    ? r.address
                        .split(/\n/)
                        .filter(Boolean)
                        .map((line, j) => (
                          <Text key={j} style={{ fontSize: 9.5 }}>
                            {line}
                          </Text>
                        ))
                    : null}
                  {r.email ? <Text style={{ fontSize: 9, color: PDF_MUTED }}>{r.email}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Oggetto */}
        {c.subject ? (
          <View style={{ flexDirection: "row", marginBottom: 16 }}>
            <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: PDF_PRIMARY, width: 52 }}>
              Oggetto:
            </Text>
            <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", flex: 1 }}>{c.subject}</Text>
          </View>
        ) : null}

        {/* Corpo */}
        <PdfDocBody doc={c.body as PMNode} />

        {/* Firma e timbro */}
        {(c.includeStamp || c.signatory) && (
          <View wrap={false} style={{ marginTop: 28, alignItems: "flex-end" }}>
            <View style={{ alignItems: "center", minWidth: 200 }}>
              {c.signatory ? (
                <Text style={{ fontSize: 10, marginBottom: c.includeStamp ? 10 : 30 }}>{c.signatory}</Text>
              ) : null}
              {c.includeStamp ? <CompanyStamp settings={settings} /> : null}
              {!c.includeStamp && (
                <View style={{ width: 180, borderBottomWidth: 0.75, borderBottomColor: "#a1a1aa" }} />
              )}
            </View>
          </View>
        )}

        <LetterheadFooter settings={settings} />
      </Page>
    </Document>
  );
}
