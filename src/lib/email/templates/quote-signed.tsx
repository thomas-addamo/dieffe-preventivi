import React from "react";
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
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", color: "#18181b" }}>
      <div style={{ background: "#1e40af", padding: "20px 24px", borderRadius: "8px 8px 0 0" }}>
        <h1 style={{ color: "white", margin: 0, fontSize: 20 }}>
          {actionEmoji} Notifica firma preventivo
        </h1>
        <p style={{ color: "#bfdbfe", margin: "4px 0 0", fontSize: 14 }}>
          Dieffe Preventivi
        </p>
      </div>

      <div style={{ padding: "24px", background: "#fff", border: "1px solid #e4e4e7", borderTop: "none" }}>
        <p style={{ fontSize: 16, margin: "0 0 16px" }}>
          Il preventivo <strong>{quoteCode}</strong> — {quoteTitle} è stato{" "}
          <strong>{actionLabel}</strong> da <strong>{signerName}</strong>.
        </p>

        <div style={{ background: "#f4f4f5", borderRadius: 6, padding: "16px", margin: "16px 0" }}>
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
        </div>

        <div style={{ textAlign: "center", margin: "24px 0" }}>
          <a
            href={`${appUrl}/preventivi/${quoteId}`}
            style={{
              background: "#1e40af",
              color: "white",
              padding: "12px 24px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            Apri preventivo
          </a>
        </div>

        <p style={{ fontSize: 12, color: "#71717a", borderTop: "1px solid #e4e4e7", paddingTop: 16, margin: "16px 0 0" }}>
          Questi dati sono stati registrati e possono essere usati come prova di {actionLabel === "accettato" ? "accettazione" : "rifiuto"}.
        </p>
      </div>

      <div style={{ padding: "12px 24px", background: "#f4f4f5", borderRadius: "0 0 8px 8px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
          Dieffe Ristrutturazioni — diefferistrutturazioni.it
        </p>
      </div>
    </div>
  );
}
