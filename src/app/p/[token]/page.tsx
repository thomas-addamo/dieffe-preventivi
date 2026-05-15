"use client";

import { use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CheckCircle, XCircle, AlertCircle, Download, X } from "lucide-react";

// Dynamic import to avoid SSR issues with canvas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import("react-signature-canvas") as any, { ssr: false }) as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type QuoteSection = {
  id: string;
  code: string;
  title: string;
  sectionNote: string | null;
  isOptional: boolean;
  isOptionalIncluded: boolean;
  orderIndex: number;
  items: QuoteItem[];
};

type QuoteItem = {
  id: string;
  description: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  notes: string | null;
  images: { id: string; cloudinaryUrl: string; caption: string | null }[];
};

type PublicQuote = {
  id: string;
  code: string;
  title: string;
  status: string;
  projectAddress: string | null;
  vatRate: number;
  discountType: string | null;
  discountValue: number | null;
  notes: string | null;
  paymentTerms: string | null;
  validUntil: string | null;
  createdAt: string;
  publicTokenExpiresAt: string | null;
  client: { name: string; address: string | null } | null;
  sections: QuoteSection[];
};

type Settings = {
  companyName: string;
  logoPath: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vatNumber: string | null;
  primaryColor: string;
  accentColor: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(str: string | null | undefined) {
  if (!str) return "";
  try {
    return format(new Date(str), "dd/MM/yyyy", { locale: it });
  } catch {
    return str;
  }
}

function fmtDateTime(str: string | Date) {
  try {
    return format(new Date(str), "dd/MM/yyyy HH:mm", { locale: it });
  } catch {
    return String(str);
  }
}

function calcSectionSubtotal(items: QuoteItem[]) {
  return items.reduce((s, i) => s + i.total, 0);
}

function calcTotals(quote: PublicQuote) {
  const normalSections = quote.sections.filter((s) => !s.isOptional);
  const optionalSections = quote.sections.filter((s) => s.isOptional);

  const baseSubtotal = normalSections.reduce((s, sec) => s + calcSectionSubtotal(sec.items), 0);
  const optIncludedSubtotal = optionalSections
    .filter((s) => s.isOptionalIncluded)
    .reduce((s, sec) => s + calcSectionSubtotal(sec.items), 0);

  const subtotalBeforeDiscount = baseSubtotal + optIncludedSubtotal;

  let discountAmount = 0;
  if (quote.discountType === "percent" && (quote.discountValue ?? 0) > 0) {
    discountAmount = subtotalBeforeDiscount * (quote.discountValue! / 100);
  } else if (quote.discountType === "fixed" && (quote.discountValue ?? 0) > 0) {
    discountAmount = quote.discountValue!;
  }

  const taxableAmount = subtotalBeforeDiscount - discountAmount;
  const vatAmount = taxableAmount * (quote.vatRate / 100);
  const total = taxableAmount + vatAmount;

  return { baseSubtotal, optIncludedSubtotal, subtotalBeforeDiscount, discountAmount, taxableAmount, vatAmount, total };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  archived: "Archiviato",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ height: 60, background: "#e5e7eb", borderRadius: 8, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 100, background: "#e5e7eb", borderRadius: 8, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 200, background: "#e5e7eb", borderRadius: 8, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 150, background: "#e5e7eb", borderRadius: 8 }} className="animate-pulse" />
    </div>
  );
}

// ─── Error states ─────────────────────────────────────────────────────────────

function ErrorPage({ error }: { error: string; status?: string }) {
  const msg = (() => {
    if (error === "link_expired")
      return {
        icon: <AlertCircle size={48} color="#f59e0b" />,
        title: "Link scaduto",
        body: "Questo link è scaduto. Contatta Dieffe Ristrutturazioni per ricevere un nuovo link.",
      };
    if (error === "quote_closed_accepted")
      return {
        icon: <CheckCircle size={48} color="#059669" />,
        title: "Preventivo già accettato",
        body: "Questo preventivo è già stato accettato. Grazie!",
      };
    if (error === "quote_closed_rejected")
      return {
        icon: <XCircle size={48} color="#ef4444" />,
        title: "Preventivo rifiutato",
        body: "Questo preventivo è stato rifiutato.",
      };
    return {
      icon: <AlertCircle size={48} color="#6b7280" />,
      title: "Link non valido",
      body: "Link non valido o inesistente.",
    };
  })();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
      <div style={{ marginBottom: 16 }}>{msg.icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{msg.title}</h2>
      <p style={{ color: "#6b7280", maxWidth: 440, margin: "0 auto" }}>{msg.body}</p>
    </div>
  );
}

// ─── Signature block ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SigRef = any;

function SignatureBlock({
  quoteCode,
  token,
  onSigned,
}: {
  quoteCode: string;
  token: string;
  onSigned: (result: { action: "accepted" | "rejected"; signerName: string; signedAt: Date }) => void;
}) {
  const sigRef = useRef<SigRef>(null);
  const [signerName, setSignerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearSig() {
    sigRef.current?.clear();
    setCanvasEmpty(true);
  }

  function onSigEnd() {
    setCanvasEmpty(sigRef.current?.isEmpty() ?? true);
  }

  async function submit(action: "accepted" | "rejected") {
    setLoading(true);
    setError(null);
    try {
      const signatureDataUrl =
        action === "accepted" ? (sigRef.current?.toDataURL("image/png") ?? "") : "";

      const res = await fetch(`/api/public/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureDataUrl, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Errore durante l'invio");
        return;
      }
      onSigned({ action, signerName, signedAt: new Date() });
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  const canAccept = signerName.trim().length >= 2 && !canvasEmpty && confirmed;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "24px",
        background: "#fff",
        marginTop: 32,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>
        Accettazione del preventivo
      </h3>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Firmando questo documento confermi di aver letto e accettato il preventivo sopra indicato,
        comprese le condizioni di pagamento.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Nome e cognome *
        </label>
        <input
          type="text"
          placeholder="Mario Rossi"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 15,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Firma *
        </label>
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#fff",
            overflow: "hidden",
            touchAction: "none",
          }}
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="#18181b"
            canvasProps={{
              style: { width: "100%", height: 150, display: "block" },
            }}
            onEnd={onSigEnd}
          />
        </div>
      </div>

      <button
        onClick={clearSig}
        style={{
          background: "none",
          border: "none",
          color: "#6b7280",
          fontSize: 13,
          cursor: "pointer",
          padding: "4px 0",
          marginBottom: 16,
          textDecoration: "underline",
        }}
      >
        Cancella firma
      </button>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
          />
          <span>
            Confermo di aver letto il preventivo n° {quoteCode} e di accettare le condizioni
            riportate, incluse le modalità di pagamento.
          </span>
        </label>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          style={{
            background: "none",
            border: "1px solid #ef4444",
            color: "#ef4444",
            borderRadius: 8,
            padding: "12px 20px",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          Rifiuta preventivo
        </button>

        <button
          onClick={() => submit("accepted")}
          disabled={!canAccept || loading}
          style={{
            flex: 1,
            background: canAccept && !loading ? "#059669" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "12px 20px",
            fontWeight: 700,
            fontSize: 15,
            cursor: canAccept && !loading ? "pointer" : "not-allowed",
            minWidth: 180,
          }}
        >
          {loading ? "Invio in corso..." : "Accetta e firma"}
        </button>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: "100%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Rifiuta preventivo</h3>
              <button onClick={() => setShowRejectModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Sei sicuro di voler rifiutare il preventivo? Questa azione non può essere annullata.
            </p>
            {signerName.trim().length < 2 && (
              <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
                Inserisci il tuo nome e cognome prima di rifiutare.
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{ background: "#f4f4f5", border: "none", borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
              >
                Annulla
              </button>
              <button
                onClick={() => { setShowRejectModal(false); submit("rejected"); }}
                disabled={signerName.trim().length < 2 || loading}
                style={{
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "10px 16px",
                  fontWeight: 600,
                  cursor: signerName.trim().length >= 2 ? "pointer" : "not-allowed",
                  opacity: signerName.trim().length < 2 ? 0.5 : 1,
                }}
              >
                Sì, rifiuta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signed confirmation ──────────────────────────────────────────────────────

function SignedConfirmation({
  action,
  signerName,
  signedAt,
}: {
  action: "accepted" | "rejected";
  signerName: string;
  signedAt: Date;
}) {
  return (
    <div
      style={{
        border: `1px solid ${action === "accepted" ? "#86efac" : "#fca5a5"}`,
        borderRadius: 12,
        padding: 24,
        background: action === "accepted" ? "#f0fdf4" : "#fef2f2",
        textAlign: "center",
        marginTop: 32,
      }}
    >
      {action === "accepted" ? (
        <CheckCircle size={48} color="#059669" style={{ marginBottom: 12 }} />
      ) : (
        <XCircle size={48} color="#ef4444" style={{ marginBottom: 12 }} />
      )}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        {action === "accepted" ? "Preventivo accettato" : "Preventivo rifiutato"}
      </h3>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        {action === "accepted"
          ? `Preventivo accettato il ${fmtDateTime(signedAt)} da ${signerName}`
          : `Preventivo rifiutato il ${fmtDateTime(signedAt)} da ${signerName}`}
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
        Riceverai una conferma dall&apos;ufficio Dieffe Ristrutturazioni.
      </p>
    </div>
  );
}

// ─── Quote view ───────────────────────────────────────────────────────────────

function QuoteView({
  quote,
  settings,
  token,
}: {
  quote: PublicQuote;
  settings: Settings | null;
  token: string;
}) {
  const [signedInfo, setSignedInfo] = useState<{
    action: "accepted" | "rejected";
    signerName: string;
    signedAt: Date;
  } | null>(null);

  const totals = calcTotals(quote);
  const normalSections = quote.sections.filter((s) => !s.isOptional);
  const optionalSections = quote.sections.filter((s) => s.isOptional);
  const primary = settings?.primaryColor ?? "#1e40af";
  const isClosed = ["accepted", "rejected"].includes(quote.status);

  const logoUrl = settings?.logoPath
    ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_200/${settings.logoPath}`
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={settings?.companyName} style={{ height: 36, objectFit: "contain" }} />
            )}
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{settings?.companyName ?? "Dieffe Ristrutturazioni"}</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 48px" }}>
        {/* Token expiry banner */}
        {quote.publicTokenExpiresAt && !isClosed && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fbbf24",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#92400e",
          }}>
            Questo link è valido fino al {fmtDateTime(quote.publicTokenExpiresAt)}
          </div>
        )}

        {/* Quote header */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: primary, fontSize: 15 }}>
              {quote.code}
            </span>
            <span style={{
              background: quote.status === "accepted" ? "#dcfce7" : quote.status === "sent" ? "#dbeafe" : "#f4f4f5",
              color: quote.status === "accepted" ? "#166534" : quote.status === "sent" ? "#1e40af" : "#52525b",
              padding: "2px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {STATUS_LABELS[quote.status] ?? quote.status}
            </span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{quote.title}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "#6b7280" }}>
            <span>Data: {fmtDate(quote.createdAt)}</span>
            {quote.validUntil && <span>Valido fino al: {fmtDate(quote.validUntil)}</span>}
            {quote.projectAddress && <span>Cantiere: {quote.projectAddress}</span>}
          </div>
        </div>

        {/* Client block */}
        {quote.client && (
          <div style={{ background: "#f4f4f5", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Destinatario</div>
            <div style={{ fontWeight: 600 }}>{quote.client.name}</div>
            {quote.client.address && <div style={{ fontSize: 13, color: "#6b7280" }}>{quote.client.address}</div>}
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 50px 60px 70px 40px 80px", background: primary, padding: "8px 12px", gap: 4 }}>
            {["N.", "Descrizione", "U.M.", "Qtà", "Prezzo", "Sc.", "Totale"].map((h, i) => (
              <div key={i} style={{ color: "white", fontWeight: 700, fontSize: 12, textAlign: i > 1 ? "right" : "left" }}>{h}</div>
            ))}
          </div>

          {normalSections.map((section) => (
            <SectionBlock key={section.id} section={section} isOptional={false} primary={primary} />
          ))}

          {optionalSections.length > 0 && (
            <>
              <div style={{ background: "#f3e8ff", borderTop: "1px solid #7c3aed", borderBottom: "1px solid #7c3aed", padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 13, color: "#5b21b6", letterSpacing: 1 }}>
                PARTE OPZIONALE
              </div>
              {optionalSections.map((section) => (
                <SectionBlock key={section.id} section={section} isOptional={true} primary={primary} />
              ))}
            </>
          )}
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{ width: "100%", maxWidth: 280, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            {totals.optIncludedSubtotal > 0 && (
              <TotalRow label="+ Opzionali incluse" value={fmtCurrency(totals.optIncludedSubtotal)} />
            )}
            <TotalRow label="Subtotale" value={fmtCurrency(totals.subtotalBeforeDiscount)} />
            {totals.discountAmount > 0 && (
              <TotalRow label="Sconto" value={`-${fmtCurrency(totals.discountAmount)}`} valueColor="#ef4444" />
            )}
            {totals.discountAmount > 0 && (
              <TotalRow label="Imponibile" value={fmtCurrency(totals.taxableAmount)} />
            )}
            <TotalRow label={`IVA ${quote.vatRate}%`} value={fmtCurrency(totals.vatAmount)} />
            <div style={{ background: primary, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>TOTALE</span>
              <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{fmtCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {quote.paymentTerms && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Condizioni di pagamento</div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{quote.paymentTerms}</p>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Note</div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{quote.notes}</p>
          </div>
        )}

        {/* PDF download */}
        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <a
            href={`/api/public/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#f4f4f5",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 16px",
              color: "#18181b",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            <Download size={16} /> Scarica PDF
          </a>
        </div>

        {/* Signature block or result */}
        {signedInfo ? (
          <SignedConfirmation {...signedInfo} />
        ) : isClosed ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 20, textAlign: "center", marginTop: 32 }}>
            <CheckCircle size={40} color="#059669" style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 600, fontSize: 16 }}>
              {quote.status === "accepted" ? "Preventivo già accettato" : "Preventivo già rifiutato"}
            </p>
          </div>
        ) : (
          <SignatureBlock quoteCode={quote.code} token={token} onSigned={setSignedInfo} />
        )}
      </div>

      {/* Footer */}
      <footer style={{ background: "#f4f4f5", borderTop: "1px solid #e5e7eb", padding: "16px", textAlign: "center", fontSize: 12, color: "#71717a" }}>
        Documento generato da Dieffe Preventivi • diefferistrutturazioni.it
      </footer>
    </div>
  );
}

function SectionBlock({ section, isOptional, primary }: { section: QuoteSection; isOptional: boolean; primary: string }) {
  const bg = isOptional ? "#f3e8ff" : "#dbeafe";
  const color = isOptional ? "#5b21b6" : primary;
  const subtotal = calcSectionSubtotal(section.items);

  return (
    <div>
      <div style={{ background: bg, padding: "8px 12px", display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color }}>
          {section.code} — {section.title}
          {isOptional && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#7c3aed" }}>
              {section.isOptionalIncluded ? "✓ incluso" : "non incluso"}
            </span>
          )}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color }}>{fmtCurrency(subtotal)}</span>
      </div>
      {section.sectionNote && (
        <div style={{ padding: "4px 12px 6px", fontSize: 12, fontStyle: "italic", color: "#6b7280", borderBottom: "1px solid #f0f0f0" }}>
          {section.sectionNote}
        </div>
      )}
      {section.items.map((item, idx) => (
        <div key={item.id}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 50px 60px 70px 40px 80px", padding: "8px 12px", gap: 4, borderTop: "1px solid #f0f0f0", background: idx % 2 === 1 ? "#f9fafb" : "#fff", alignItems: "start" }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{section.code}.{idx + 1}</div>
            <div style={{ fontSize: 13 }}>
              {item.description}
              {item.notes && <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>{item.notes}</div>}
            </div>
            <div style={{ fontSize: 12, textAlign: "right" }}>{item.unitOfMeasure}</div>
            <div style={{ fontSize: 12, textAlign: "right" }}>{fmtNum(item.quantity)}</div>
            <div style={{ fontSize: 12, textAlign: "right" }}>{fmtCurrency(item.unitPrice)}</div>
            <div style={{ fontSize: 12, textAlign: "right" }}>{item.discount > 0 ? `${item.discount}%` : "—"}</div>
            <div style={{ fontSize: 12, textAlign: "right", fontWeight: 700 }}>{fmtCurrency(item.total)}</div>
          </div>
          {item.images.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#fafafa", flexWrap: "wrap", borderTop: "1px solid #f0f0f0" }}>
              {item.images.slice(0, 2).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.cloudinaryUrl.replace("/upload/", "/upload/f_auto,q_auto,w_300/")}
                  alt={img.caption ?? ""}
                  loading="lazy"
                  style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 4, border: "1px solid #e5e7eb" }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TotalRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<"loading" | "error" | "loaded">("loading");
  const [errorType, setErrorType] = useState<string>("");
  const [errorStatus, setErrorStatus] = useState<string | undefined>(undefined);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    fetch(`/api/public/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "quote_closed") {
            setErrorType(`quote_closed_${data.status}`);
          } else {
            setErrorType(data.error ?? "unknown");
          }
          setState("error");
          return;
        }
        setQuote(data.quote);
        setSettings(data.settings);
        setState("loaded");
      })
      .catch(() => {
        setErrorType("unknown");
        setState("error");
      });
  }, [token]);

  if (state === "loading") return <Skeleton />;
  if (state === "error") return <ErrorPage error={errorType} status={errorStatus} />;
  if (!quote) return <ErrorPage error="unknown" />;

  return <QuoteView quote={quote} settings={settings} token={token} />;
}
