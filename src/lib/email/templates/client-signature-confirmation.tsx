import * as React from "react";
import {
  Html,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Head,
} from "@react-email/components";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ClientSignatureConfirmationEmailProps {
  quoteCode: string;
  quoteTitle: string;
  signerName: string;
  action: "accepted" | "rejected";
  signedAt: Date;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  companyName: string;
}

export function ClientSignatureConfirmationEmail({
  quoteCode,
  quoteTitle,
  signerName,
  action,
  signedAt,
  companyEmail,
  companyPhone,
  companyWebsite,
  companyName,
}: ClientSignatureConfirmationEmailProps) {
  const formattedDate = format(signedAt, "dd/MM/yyyy HH:mm", { locale: it });
  const isAccepted = action === "accepted";

  const headerBg = isAccepted ? "#059669" : "#1e40af";
  const headerSubColor = isAccepted ? "#d1fae5" : "#bfdbfe";
  const headerTitle = isAccepted ? "✅ Preventivo accettato" : "Conferma rifiuto preventivo";

  return (
    <Html lang="it">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 8, overflow: "hidden", border: "1px solid #e4e4e7" }}>
          {/* Header */}
          <Section style={{ backgroundColor: headerBg, padding: "20px 24px" }}>
            <Text style={{ color: "#ffffff", margin: 0, fontSize: 20, fontWeight: "bold" }}>
              {headerTitle}
            </Text>
            <Text style={{ color: headerSubColor, margin: "4px 0 0", fontSize: 14 }}>
              {companyName}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: "24px" }}>
            <Text style={{ fontSize: 15, margin: "0 0 12px", color: "#18181b" }}>
              Gentile {signerName},
            </Text>

            {isAccepted ? (
              <>
                <Text style={{ fontSize: 14, color: "#52525b", lineHeight: "1.6", margin: "0 0 20px" }}>
                  La ringraziamo per aver accettato il preventivo. Di seguito il riepilogo della sua accettazione.
                </Text>

                <Section style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "16px", margin: "0 0 20px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "4px 0", color: "#166534", width: 120 }}>Preventivo:</td>
                        <td style={{ padding: "4px 0", fontWeight: "bold" }}>{quoteCode} — {quoteTitle}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 0", color: "#166534" }}>Data firma:</td>
                        <td style={{ padding: "4px 0" }}>{formattedDate}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 0", color: "#166534" }}>Stato:</td>
                        <td style={{ padding: "4px 0", fontWeight: "bold", color: "#059669" }}>✅ Accettato</td>
                      </tr>
                    </tbody>
                  </table>
                </Section>

                <Text style={{ fontSize: 14, color: "#52525b", lineHeight: "1.6", margin: "0 0 8px" }}>
                  In allegato trova copia del preventivo con la sua firma.
                </Text>
                <Text style={{ fontSize: 14, color: "#52525b", lineHeight: "1.6", margin: "0 0 20px" }}>
                  Il nostro team la contatterà a breve per concordare i dettagli operativi.
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 14, color: "#52525b", lineHeight: "1.6", margin: "0 0 12px" }}>
                  Confermiamo la ricezione del suo rifiuto del preventivo{" "}
                  <strong>{quoteCode}</strong> — {quoteTitle}.
                </Text>
                <Text style={{ fontSize: 14, color: "#52525b", lineHeight: "1.6", margin: "0 0 20px" }}>
                  Il nostro team potrebbe contattarla per capire come migliorare la proposta.
                </Text>
              </>
            )}

            {(companyEmail || companyPhone || companyWebsite) && (
              <>
                <Hr style={{ borderColor: "#e4e4e7", margin: "16px 0" }} />
                <Text style={{ fontSize: 13, fontWeight: "bold", color: "#18181b", margin: "0 0 6px" }}>
                  Per qualsiasi necessità:
                </Text>
                {companyEmail && (
                  <Text style={{ fontSize: 13, color: "#52525b", margin: "4px 0" }}>📧 {companyEmail}</Text>
                )}
                {companyPhone && (
                  <Text style={{ fontSize: 13, color: "#52525b", margin: "4px 0" }}>📞 {companyPhone}</Text>
                )}
                {companyWebsite && (
                  <Text style={{ fontSize: 13, color: "#52525b", margin: "4px 0" }}>🌐 {companyWebsite}</Text>
                )}
              </>
            )}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: "#f4f4f5", padding: "12px 24px", textAlign: "center" }}>
            <Text style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
              {companyName} — impresadieffe.it
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
