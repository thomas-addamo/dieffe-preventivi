import * as React from "react";
import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Head,
} from "@react-email/components";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface QuoteSignedEmailProps {
  quoteCode: string;
  quoteTitle: string;
  quoteId: string;
  signerName: string;
  action: "accepted" | "rejected";
  signedAt: Date;
  ipAddress: string | null;
  appUrl: string;
}

export function QuoteSignedEmail({
  quoteCode,
  quoteTitle,
  signerName,
  action,
  signedAt,
  ipAddress,
  quoteId,
  appUrl,
}: QuoteSignedEmailProps) {
  const actionLabel = action === "accepted" ? "accettato" : "rifiutato";
  const actionEmoji = action === "accepted" ? "✅" : "❌";
  const formattedDate = format(signedAt, "dd/MM/yyyy HH:mm", { locale: it });

  return (
    <Html lang="it">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden", border: "1px solid #e4e4e7" }}>
          {/* Header */}
          <Section style={{ backgroundColor: "#1e40af", padding: "20px 24px" }}>
            <Text style={{ color: "#ffffff", margin: 0, fontSize: 20, fontWeight: "bold" }}>
              {actionEmoji} Notifica firma preventivo
            </Text>
            <Text style={{ color: "#bfdbfe", margin: "4px 0 0", fontSize: 14 }}>
              Dieffe Preventivi
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "24px" }}>
            <Text style={{ fontSize: 16, margin: "0 0 16px", color: "#18181b" }}>
              Il preventivo <strong>{quoteCode}</strong> — {quoteTitle} è stato{" "}
              <strong>{actionLabel}</strong> da <strong>{signerName}</strong>.
            </Text>

            <Section style={{ backgroundColor: "#f4f4f5", borderRadius: 6, padding: "16px", margin: "16px 0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0", color: "#71717a", width: 160 }}>Nome firmatario:</td>
                    <td style={{ padding: "4px 0", fontWeight: "bold" }}>{signerName}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0", color: "#71717a" }}>Azione:</td>
                    <td style={{ padding: "4px 0", fontWeight: "bold", color: action === "accepted" ? "#059669" : "#ef4444" }}>
                      {action === "accepted" ? "✅ Accettato" : "❌ Rifiutato"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0", color: "#71717a" }}>Data e ora:</td>
                    <td style={{ padding: "4px 0" }}>{formattedDate}</td>
                  </tr>
                  {ipAddress && (
                    <tr>
                      <td style={{ padding: "4px 0", color: "#71717a" }}>Indirizzo IP:</td>
                      <td style={{ padding: "4px 0", fontFamily: "monospace" }}>{ipAddress}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button
                href={`${appUrl}/preventivi/${quoteId}`}
                style={{
                  backgroundColor: "#1e40af",
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: 14,
                  display: "inline-block",
                }}
              >
                Apri preventivo
              </Button>
            </Section>

            <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />
            <Text style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
              Questi dati sono stati registrati e possono essere usati come prova di{" "}
              {action === "accepted" ? "accettazione" : "rifiuto"}.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: "#f4f4f5", padding: "12px 24px", textAlign: "center" }}>
            <Text style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
              Dieffe Ristrutturazioni — impresadieffe.it
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
