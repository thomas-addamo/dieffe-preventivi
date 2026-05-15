import React from "react";
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

  if (!isAccepted) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", color: "#18181b" }}>
        <div style={{ background: "#1e40af", padding: "20px 24px", borderRadius: "8px 8px 0 0" }}>
          <h1 style={{ color: "white", margin: 0, fontSize: 20 }}>Conferma rifiuto preventivo</h1>
          <p style={{ color: "#bfdbfe", margin: "4px 0 0", fontSize: 14 }}>{companyName}</p>
        </div>
        <div style={{ padding: "24px", background: "#fff", border: "1px solid #e4e4e7", borderTop: "none" }}>
          <p style={{ fontSize: 15 }}>Gentile {signerName},</p>
          <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6 }}>
            Confermiamo la ricezione del suo rifiuto del preventivo{" "}
            <strong>{quoteCode}</strong> — {quoteTitle}.
          </p>
          <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6 }}>
            Il nostro team potrebbe contattarla per capire come migliorare la proposta.
          </p>
          {(companyEmail || companyPhone) && (
            <div style={{ marginTop: 20, fontSize: 13, color: "#52525b" }}>
              {companyEmail && <p style={{ margin: "4px 0" }}>📧 {companyEmail}</p>}
              {companyPhone && <p style={{ margin: "4px 0" }}>📞 {companyPhone}</p>}
              {companyWebsite && <p style={{ margin: "4px 0" }}>🌐 {companyWebsite}</p>}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 24px", background: "#f4f4f5", borderRadius: "0 0 8px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{companyName} — diefferistrutturazioni.it</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 600, margin: "0 auto", color: "#18181b" }}>
      <div style={{ background: "#059669", padding: "20px 24px", borderRadius: "8px 8px 0 0" }}>
        <h1 style={{ color: "white", margin: 0, fontSize: 20 }}>✅ Preventivo accettato</h1>
        <p style={{ color: "#d1fae5", margin: "4px 0 0", fontSize: 14 }}>{companyName}</p>
      </div>

      <div style={{ padding: "24px", background: "#fff", border: "1px solid #e4e4e7", borderTop: "none" }}>
        <p style={{ fontSize: 15, marginBottom: 16 }}>Gentile {signerName},</p>
        <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6, marginBottom: 20 }}>
          La ringraziamo per aver accettato il preventivo. Di seguito il riepilogo della sua accettazione.
        </p>

        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "16px", marginBottom: 20 }}>
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
        </div>

        <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6, marginBottom: 8 }}>
          In allegato trova copia del preventivo con la sua firma.
        </p>
        <p style={{ fontSize: 14, color: "#52525b", lineHeight: 1.6, marginBottom: 20 }}>
          Il nostro team la contatterà a breve per concordare i dettagli operativi.
        </p>

        {(companyEmail || companyPhone || companyWebsite) && (
          <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: 16, fontSize: 13, color: "#52525b" }}>
            <p style={{ fontWeight: "bold", marginBottom: 6 }}>Per qualsiasi necessità:</p>
            {companyEmail && <p style={{ margin: "4px 0" }}>📧 {companyEmail}</p>}
            {companyPhone && <p style={{ margin: "4px 0" }}>📞 {companyPhone}</p>}
            {companyWebsite && <p style={{ margin: "4px 0" }}>🌐 {companyWebsite}</p>}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 24px", background: "#f4f4f5", borderRadius: "0 0 8px 8px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
          {companyName} • P.IVA 10908150013
        </p>
      </div>
    </div>
  );
}
