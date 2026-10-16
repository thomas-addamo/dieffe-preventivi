import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Link,
  Img,
} from "@react-email/components";
import {
  QUOTE_EMAIL_CLOSING,
  QUOTE_EMAIL_CONFIDENTIALITY,
  QUOTE_EMAIL_LINK_INTRO,
  QUOTE_EMAIL_REGARDS,
  type QuoteEmailContent,
} from "../quote/text";

// Mail con cui si invia il preventivo al cliente: impostazione da lettera,
// lineare. Testo in primo piano, riferimenti su righe divise da linee sottili,
// pulsante solo bordato, piè di pagina con i dati dell'impresa.

const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const ink = "#1f1f23";
const muted = "#6b6b74";
const hair = "#e6e6ea";
const p: React.CSSProperties = { fontSize: 15, lineHeight: "24px", color: ink, margin: "0 0 18px" };
const small: React.CSSProperties = { fontSize: 12, lineHeight: "18px", color: muted, margin: 0 };

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((block, i) => (
          <Text key={i} style={{ ...p, whiteSpace: "pre-line" }}>
            {block}
          </Text>
        ))}
    </>
  );
}

function RefRow({ label, value, last, strong }: { label: string; value: string; last?: boolean; strong?: boolean }) {
  return (
    <Row style={{ borderBottom: last ? "none" : `1px solid ${hair}` }}>
      <Column style={{ width: 110, padding: "9px 0", verticalAlign: "top" }}>
        <Text style={{ ...small, fontSize: 13 }}>{label}</Text>
      </Column>
      <Column style={{ padding: "9px 0", verticalAlign: "top" }}>
        <Text style={{ fontSize: 14, lineHeight: "20px", color: ink, margin: 0, fontWeight: strong ? 600 : 400 }}>
          {value}
        </Text>
      </Column>
    </Row>
  );
}

const href = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export function QuoteToClientEmail({
  content,
  brandColor,
  logoUrl,
}: {
  content: QuoteEmailContent;
  brandColor: string;
  logoUrl: string | null;
}) {
  const { quote, link, notes, signature, company } = content;
  const pinCode = link?.pinLine.match(/^Codice di accesso: (.+)$/)?.[1];

  return (
    <Html lang="it">
      <Head />
      <Preview>{`Preventivo ${quote.code} · ${quote.title}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "0 24px" }}>
          {/* Intestazione */}
          <Section style={{ paddingBottom: 14, borderBottom: `1px solid ${hair}` }}>
            {logoUrl ? (
              <Img src={logoUrl} alt={signature.companyName} height={34} style={{ height: 34, width: "auto" }} />
            ) : (
              <Text style={{ fontSize: 17, fontWeight: 700, color: ink, margin: 0 }}>{signature.companyName}</Text>
            )}
          </Section>

          {/* Testo */}
          <Section style={{ paddingTop: 26 }}>
            <Paragraphs text={content.message} />

            <Section style={{ borderTop: `1px solid ${hair}`, borderBottom: `1px solid ${hair}`, margin: "4px 0 24px" }}>
              <RefRow label="Preventivo" value={quote.code} />
              <RefRow label="Lavori" value={quote.title} />
              <RefRow label="Totale" value={quote.total} strong last />
            </Section>

            {link && (
              <>
                <Text style={{ ...p, margin: "0 0 12px" }}>{QUOTE_EMAIL_LINK_INTRO}</Text>
                <Section style={{ margin: "0 0 8px" }}>
                  <Link
                    href={link.url}
                    style={{
                      display: "inline-block",
                      border: `1px solid ${brandColor}`,
                      borderRadius: 5,
                      color: brandColor,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "9px 18px",
                      textDecoration: "none",
                    }}
                  >
                    Apri il preventivo →
                  </Link>
                </Section>
                <Text style={{ ...small, margin: "0 0 22px" }}>Valido fino al {link.expiresLabel}</Text>
                <Text style={p}>
                  {pinCode ? (
                    <>
                      Codice di accesso:{" "}
                      <strong style={{ fontSize: 16, letterSpacing: 1.5 }}>{pinCode}</strong>
                    </>
                  ) : (
                    link.pinLine
                  )}
                </Text>
              </>
            )}

            {notes?.trim() && <Paragraphs text={notes} />}

            <Text style={p}>{QUOTE_EMAIL_CLOSING}</Text>
            <Text style={{ ...p, margin: "0 0 2px" }}>{QUOTE_EMAIL_REGARDS}</Text>
            <Text style={{ ...p, fontWeight: 600, margin: 0 }}>{signature.senderName}</Text>
            <Text style={{ ...p, color: muted, margin: "0 0 32px" }}>{signature.companyName}</Text>
          </Section>

          {/* Piè di pagina */}
          <Section style={{ borderTop: `2px solid ${brandColor}`, paddingTop: 18 }}>
            <Text style={{ fontSize: 13, fontWeight: 700, color: ink, margin: "0 0 6px", letterSpacing: 0.3 }}>
              {signature.companyName}
            </Text>
            {(company.address || company.vatNumber) && (
              <Text style={small}>
                {[company.address, company.vatNumber && `P.IVA ${company.vatNumber}`].filter(Boolean).join("  ·  ")}
              </Text>
            )}
            <Text style={small}>
              {company.phone && (
                <>
                  <Link href={`tel:${company.phone.replace(/\s+/g, "")}`} style={{ color: muted, textDecoration: "none" }}>
                    Tel. {company.phone}
                  </Link>
                  {"  ·  "}
                </>
              )}
              <Link href={`mailto:${company.email}`} style={{ color: muted, textDecoration: "none" }}>
                {company.email}
              </Link>
              {company.website && (
                <>
                  {"  ·  "}
                  <Link href={href(company.website)} style={{ color: brandColor, textDecoration: "none" }}>
                    {company.website.replace(/^https?:\/\//i, "")}
                  </Link>
                </>
              )}
            </Text>
            <Text style={{ ...small, fontSize: 11, lineHeight: "16px", color: "#9a9aa3", margin: "18px 0 0" }}>
              {QUOTE_EMAIL_CONFIDENTIALITY}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
