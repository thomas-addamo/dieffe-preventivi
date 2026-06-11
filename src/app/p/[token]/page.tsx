"use client";

import { use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CheckCircle, XCircle, AlertCircle, Download, X } from "lucide-react";

// ─── Privacy Modal ────────────────────────────────────────────────────────────

function PrivacyModal({ settings, onClose }: { settings: Settings | null; onClose: () => void }) {
  const today = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 600, width: "100%", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Informativa sul trattamento dei dati personali</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color="#6b7280" />
          </button>
        </div>
        <div style={{ padding: "20px", overflowY: "auto", fontSize: 13, lineHeight: 1.8, color: "#374151" }}>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
            ai sensi dell&apos;art. 13 del Regolamento UE 2016/679 (GDPR)
          </p>

          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>TITOLARE DEL TRATTAMENTO</h3>
          <p style={{ marginBottom: 16 }}>
            {settings?.companyName || "Dieffe Ristrutturazioni"}<br />
            {settings?.address && <>{settings.address}<br /></>}
            {settings?.vatNumber && <>P.IVA: {settings.vatNumber}<br /></>}
            {settings?.email && <>Email: {settings.email}</>}
          </p>

          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>DATI RACCOLTI E FINALITÀ</h3>
          <p style={{ marginBottom: 8 }}>In occasione della visualizzazione e accettazione del preventivo, vengono raccolti i seguenti dati:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
            <li><strong>Indirizzo IP:</strong> raccolto con il suo esplicito consenso ai fini della validazione legale della firma elettronica (art. 6.1.a GDPR)</li>
            <li><strong>Nome e cognome:</strong> necessario per identificare il firmatario</li>
            <li><strong>Indirizzo email:</strong> per l&apos;invio della copia del documento firmato</li>
            <li><strong>Firma elettronica:</strong> per la validazione dell&apos;accettazione del preventivo</li>
            <li><strong>Data e ora della firma:</strong> per la registrazione del momento dell&apos;accettazione</li>
          </ul>

          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>COOKIE UTILIZZATI</h3>
          <p style={{ marginBottom: 16 }}>
            Questo sito utilizza esclusivamente cookie tecnici di sessione, necessari al funzionamento della pagina.
            Non vengono utilizzati cookie di profilazione, tracciamento o analytics.
          </p>

          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>CONSERVAZIONE DEI DATI</h3>
          <p style={{ marginBottom: 16 }}>
            I dati raccolti in fase di firma vengono conservati per il periodo necessario all&apos;esecuzione del contratto
            e agli obblighi di legge (minimo 10 anni per documenti contabili).
          </p>

          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>DIRITTI DELL&apos;INTERESSATO</h3>
          <p style={{ marginBottom: 16 }}>
            Ai sensi degli artt. 15-22 GDPR, ha il diritto di accedere, rettificare, cancellare i suoi dati o opporsi al trattamento.
            Per esercitare i suoi diritti contatti:{" "}
            <a href={`mailto:${settings?.email || "impresa.dieffe@gmail.com"}`} style={{ color: "#1e40af" }}>
              {settings?.email || "impresa.dieffe@gmail.com"}
            </a>
          </p>

          <p style={{ fontSize: 11, color: "#9ca3af" }}>Data ultimo aggiornamento: {today}</p>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb" }}>
          <button
            onClick={onClose}
            style={{ width: "100%", padding: "10px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cookie Banner ────────────────────────────────────────────────────────────

function CookieBanner({ settings, onAccept }: { settings: Settings | null; onAccept: () => void }) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  return (
    <>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
        background: "#fff", borderTop: "1px solid #e5e7eb",
        padding: "16px",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "#374151", margin: 0, flex: 1, minWidth: 200, lineHeight: 1.6 }}>
            🍪 Questo sito utilizza cookie tecnici necessari al funzionamento della pagina (sessione e sicurezza).
            Non vengono utilizzati cookie di profilazione o tracciamento di terze parti.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowPrivacy(true)}
              style={{ padding: "8px 14px", background: "none", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
            >
              Informativa Privacy
            </button>
            <button
              onClick={onAccept}
              style={{ padding: "8px 16px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Ho capito, continua →
            </button>
          </div>
        </div>
      </div>
      {showPrivacy && <PrivacyModal settings={settings} onClose={() => setShowPrivacy(false)} />}
    </>
  );
}

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
  lumpSum?: boolean | null;
  lumpSumPrice?: number | null;
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

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.XXX.XXX.${parts[3]}`;
  }
  return ip; // IPv6 — show as-is
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

function calcSectionSubtotal(section: QuoteSection) {
  if (section.lumpSum) return section.lumpSumPrice ?? 0;
  return section.items.reduce((s, i) => s + i.total, 0);
}

function calcTotals(quote: PublicQuote) {
  const normalSections = quote.sections.filter((s) => !s.isOptional);
  const optionalSections = quote.sections.filter((s) => s.isOptional);

  const baseSubtotal = normalSections.reduce((s, sec) => s + calcSectionSubtotal(sec), 0);
  const optIncludedSubtotal = optionalSections
    .filter((s) => s.isOptionalIncluded)
    .reduce((s, sec) => s + calcSectionSubtotal(sec), 0);

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
      <div style={{ height: 60, background: "#e5e7eb", borderRadius: 12, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 100, background: "#e5e7eb", borderRadius: 12, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 200, background: "#e5e7eb", borderRadius: 12, marginBottom: 16 }} className="animate-pulse" />
      <div style={{ height: 150, background: "#e5e7eb", borderRadius: 12 }} className="animate-pulse" />
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

function IpBlockedMessage({ settings }: { settings: Settings | null }) {
  return (
    <div style={{ border: "1px solid #fbbf24", borderRadius: 16, padding: 24, background: "#fffbeb", marginTop: 32 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#92400e" }}>
        ⚠️ Impossibile completare la firma
      </h3>
      <p style={{ fontSize: 14, color: "#78350f", marginBottom: 12, lineHeight: 1.6 }}>
        Non è possibile rilevare il tuo indirizzo IP, necessario per garantire la validità legale della firma elettronica.
      </p>
      <p style={{ fontSize: 13, color: "#78350f", marginBottom: 6, fontWeight: 600 }}>Questo può accadere se:</p>
      <ul style={{ fontSize: 13, color: "#78350f", lineHeight: 1.8, paddingLeft: 20, marginBottom: 16 }}>
        <li>Stai usando un browser con protezione avanzata della privacy (es. Brave)</li>
        <li>Hai un'estensione che blocca il tracciamento</li>
        <li>Stai usando una VPN con funzioni anti-tracking</li>
        <li>La tua rete aziendale blocca certe connessioni</li>
      </ul>
      <p style={{ fontSize: 13, color: "#78350f", marginBottom: 6, fontWeight: 600 }}>Come risolvere:</p>
      <ol style={{ fontSize: 13, color: "#78350f", lineHeight: 1.8, paddingLeft: 20, marginBottom: 20 }}>
        <li>Prova ad aprire questo link in un altro browser (Chrome, Safari, Firefox)</li>
        <li>Disabilita temporaneamente le estensioni privacy per questa pagina</li>
        <li>Disabilita la VPN per completare la firma</li>
      </ol>
      <p style={{ fontSize: 13, color: "#78350f", fontWeight: 600 }}>Per assistenza contatta:</p>
      <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>
        {settings?.email && <p style={{ margin: "2px 0" }}>📧 {settings.email}</p>}
        {settings?.phone && <p style={{ margin: "2px 0" }}>📞 {settings.phone}</p>}
        {!settings?.email && <p style={{ margin: "2px 0" }}>📧 impresa.dieffe@gmail.com</p>}
        {!settings?.phone && <p style={{ margin: "2px 0" }}>📞 3493191144</p>}
      </div>
    </div>
  );
}

function SignatureBlock({
  quoteCode,
  token,
  settings,
  onSigned,
}: {
  quoteCode: string;
  token: string;
  settings: Settings | null;
  onSigned: (result: { action: "accepted" | "rejected"; signerName: string; signedAt: Date }) => void;
}) {
  const sigRef = useRef<SigRef>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [ipConsent, setIpConsent] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IP detection state
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [ipLoading, setIpLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/detect-ip")
      .then((r) => r.json())
      .then((d) => {
        if (d.ip) {
          setDetectedIp(d.ip);
          setIpBlocked(false);
        } else {
          setIpBlocked(true);
        }
      })
      .catch(() => setIpBlocked(true))
      .finally(() => setIpLoading(false));
  }, []);

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
        body: JSON.stringify({
          signerName,
          signerEmail,
          signatureDataUrl,
          action,
          ipConsent,
          privacyConsent,
          clientIp: detectedIp,
        }),
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

  const emailValid = isValidEmail(signerEmail);
  const canAccept =
    signerName.trim().length >= 2 &&
    emailValid &&
    !canvasEmpty &&
    confirmed &&
    privacyConsent &&
    !!detectedIp &&
    ipConsent;
  const canReject =
    signerName.trim().length >= 2 &&
    emailValid &&
    privacyConsent &&
    !!detectedIp &&
    ipConsent;

  // Show IP-blocked error (but still allow page content to be read)
  if (!ipLoading && ipBlocked) {
    return <IpBlockedMessage settings={settings} />;
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "24px", background: "#fff", marginTop: 32 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>
        Accettazione del preventivo
      </h3>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Firmando questo documento confermi di aver letto e accettato il preventivo sopra indicato,
        comprese le condizioni di pagamento.
      </p>

      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Nome e cognome *
        </label>
        <input
          type="text"
          placeholder="Mario Rossi"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px", fontSize: 15, boxSizing: "border-box" }}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Email *
        </label>
        <input
          type="email"
          placeholder="mario.rossi@email.com"
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          style={{
            width: "100%",
            border: `1px solid ${signerEmail && !emailValid ? "#ef4444" : "#d1d5db"}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 15,
            boxSizing: "border-box",
          }}
        />
        {signerEmail && !emailValid && (
          <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Inserisci un indirizzo email valido</p>
        )}
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Riceverai una copia del preventivo firmato a questo indirizzo.
        </p>
      </div>

      {/* Signature canvas */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Firma *
        </label>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", overflow: "hidden", touchAction: "none" }}>
          <SignatureCanvas
            ref={sigRef}
            penColor="#18181b"
            canvasProps={{ style: { width: "100%", height: 150, display: "block" } }}
            onEnd={onSigEnd}
          />
        </div>
      </div>
      <button
        onClick={clearSig}
        style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: "4px 0", marginBottom: 16, textDecoration: "underline" }}
      >
        Cancella firma
      </button>

      {/* IP consent box */}
      {ipLoading ? (
        <div style={{ background: "#f4f4f5", borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
          Verifica connessione in corso...
        </div>
      ) : detectedIp ? (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#0369a1" }}>
            🔒 Raccolta dati per validità legale
          </p>
          <p style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6, marginBottom: 12 }}>
            Per garantire la validità legale della firma, questo sistema registrerà il tuo indirizzo
            IP (<strong>{maskIp(detectedIp)}</strong>) e la data/ora della firma.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13, color: "#0c4a6e" }}>
            <input
              type="checkbox"
              checked={ipConsent}
              onChange={(e) => setIpConsent(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
            />
            <span>
              Acconsento alla registrazione del mio indirizzo IP ai fini della validazione della firma elettronica.
            </span>
          </label>
        </div>
      ) : null}

      {/* Accept terms checkbox */}
      <div style={{ marginBottom: 12 }}>
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

      {/* Privacy consent checkbox */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
          />
          <span>
            Ho letto e accetto l&apos;informativa sul trattamento dei dati personali ai sensi del GDPR.{" "}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              style={{ background: "none", border: "none", color: "#1e40af", textDecoration: "underline", cursor: "pointer", fontSize: 14, padding: 0 }}
            >
              Leggi informativa
            </button>
          </span>
        </label>
      </div>

      {showPrivacyModal && <PrivacyModal settings={settings} onClose={() => setShowPrivacyModal(false)} />}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading || !canReject}
          style={{
            background: "none",
            border: "1px solid #ef4444",
            color: "#ef4444",
            borderRadius: 12,
            padding: "12px 20px",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading || !canReject ? "not-allowed" : "pointer",
            opacity: loading || !canReject ? 0.4 : 1,
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
            borderRadius: 12,
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Rifiuta preventivo</h3>
              <button onClick={() => setShowRejectModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Sei sicuro di voler rifiutare il preventivo? Questa azione non può essere annullata.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{ background: "#f4f4f5", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
              >
                Annulla
              </button>
              <button
                onClick={() => { setShowRejectModal(false); submit("rejected"); }}
                disabled={loading}
                style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
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
        borderRadius: 16,
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
  const [showPrivacy, setShowPrivacy] = useState(false);

  const totals = calcTotals(quote);
  const normalSections = quote.sections.filter((s) => !s.isOptional);
  const optionalSections = quote.sections.filter((s) => s.isOptional);
  const primary = settings?.primaryColor ?? "#1e40af";
  const isClosed = ["accepted", "rejected"].includes(quote.status);

  const logoUrl = settings?.logoPath
    ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_200/${settings.logoPath}`
    : null;

  // PIN salvato in sessione (se richiesto): serve anche per scaricare il PDF.
  const storedPin = typeof window !== "undefined" ? sessionStorage.getItem(`pin_${token}`) : null;
  const pdfUrl = `/api/public/${token}/pdf${storedPin ? `?pin=${encodeURIComponent(storedPin)}` : ""}`;

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
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#92400e",
          }}>
            Questo link è valido fino al {fmtDateTime(quote.publicTokenExpiresAt)}
          </div>
        )}

        {/* Quote header */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 16 }}>
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
          <div style={{ background: "#f4f4f5", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Destinatario</div>
            <div style={{ fontWeight: 600 }}>{quote.client.name}</div>
            {quote.client.address && <div style={{ fontSize: 13, color: "#6b7280" }}>{quote.client.address}</div>}
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
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
          <div style={{ width: "100%", maxWidth: 280, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
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
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Condizioni di pagamento</div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{quote.paymentTerms}</p>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Note</div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{quote.notes}</p>
          </div>
        )}

        {/* PDF download */}
        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#f4f4f5",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
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
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 16, padding: 20, textAlign: "center", marginTop: 32 }}>
            <CheckCircle size={40} color="#059669" style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 600, fontSize: 16 }}>
              {quote.status === "accepted" ? "Preventivo già accettato" : "Preventivo già rifiutato"}
            </p>
          </div>
        ) : (
          <SignatureBlock quoteCode={quote.code} token={token} settings={settings} onSigned={setSignedInfo} />
        )}
      </div>

      {/* Footer */}
      <footer style={{ background: "#f4f4f5", borderTop: "1px solid #e5e7eb", padding: "16px", textAlign: "center", fontSize: 12, color: "#71717a" }}>
        <button
          type="button"
          onClick={() => setShowPrivacy(true)}
          style={{ background: "none", border: "none", color: "#1e40af", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}
        >
          Informativa Privacy
        </button>
        {" • "}
        {settings?.companyName || "Dieffe Ristrutturazioni Moncalieri"}
        {settings?.vatNumber && ` • P.IVA ${settings.vatNumber}`}
        {" • impresadieffe.it"}
      </footer>

      {showPrivacy && <PrivacyModal settings={settings} onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

function SectionBlock({ section, isOptional, primary }: { section: QuoteSection; isOptional: boolean; primary: string }) {
  const bg = isOptional ? "#f3e8ff" : "#dbeafe";
  const color = isOptional ? "#5b21b6" : primary;
  const subtotal = calcSectionSubtotal(section);
  const isLumpSum = !!section.lumpSum;

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
          {isLumpSum && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309" }}>
              a corpo
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
            <div style={{ fontSize: 12, textAlign: "right" }}>{isLumpSum ? "—" : fmtCurrency(item.unitPrice)}</div>
            <div style={{ fontSize: 12, textAlign: "right" }}>{!isLumpSum && item.discount > 0 ? `${item.discount}%` : "—"}</div>
            <div style={{ fontSize: 12, textAlign: "right", fontWeight: 700 }}>{isLumpSum ? "—" : fmtCurrency(item.total)}</div>
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
                  style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
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

// ─── PIN screen ───────────────────────────────────────────────────────────────

function PinScreen({
  token,
  settings,
  onVerified,
}: {
  token: string;
  settings: Settings | null;
  onVerified: (pin: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const primary = settings?.primaryColor ?? "#1e40af";
  const logoUrl = settings?.logoPath
    ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_200/${settings.logoPath}`
    : null;

  async function submitPin(pin: string) {
    if (pin.length < 6 || blocked) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${token}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success) {
        onVerified(pin);
      } else if (res.status === 429 || data.attemptsLeft === 0) {
        setBlocked(true);
        setError("Troppi tentativi. Riprova tra un'ora.");
      } else {
        setError(`PIN non corretto. Tentativi rimanenti: ${data.attemptsLeft ?? "?"}`);
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (index === 5 && digit && newDigits.every((d) => d !== "")) {
      submitPin(newDigits.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      submitPin(digits.join(""));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newDigits = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    inputRefs.current[nextEmpty]?.focus();
    if (pasted.length === 6) submitPin(pasted);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
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

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "32px 24px", width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Preventivo riservato</h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
            Inserisci il codice PIN di 6 cifre fornito dal nostro ufficio per accedere al documento.
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                autoFocus={i === 0}
                disabled={blocked || loading}
                style={{
                  width: 44,
                  height: 52,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  border: `2px solid ${error ? "#ef4444" : d ? primary : "#e5e7eb"}`,
                  borderRadius: 12,
                  outline: "none",
                  fontFamily: "monospace",
                  background: blocked ? "#f9fafb" : "#fff",
                }}
              />
            ))}
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", margin: "0 0 16px" }}>{error}</p>
          )}

          <button
            onClick={() => submitPin(digits.join(""))}
            disabled={loading || digits.join("").length < 6 || blocked}
            style={{
              width: "100%",
              padding: "12px",
              background: primary,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading || digits.join("").length < 6 || blocked ? "not-allowed" : "pointer",
              opacity: loading || digits.join("").length < 6 || blocked ? 0.5 : 1,
            }}
          >
            {loading ? "Verifica in corso..." : "Accedi al documento"}
          </button>

          {(settings?.phone || settings?.email) && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 8px" }}>Hai bisogno di aiuto?</p>
              {settings.phone && <p style={{ fontSize: 13, color: "#374151", margin: "4px 0" }}>📞 {settings.phone}</p>}
              {settings.email && <p style={{ fontSize: 13, color: "#374151", margin: "4px 0" }}>📧 {settings.email}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<"loading" | "error" | "pin" | "loaded">("loading");
  const [errorType, setErrorType] = useState<string>("");
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    const consent = typeof window !== "undefined" ? localStorage.getItem("cookie_consent_public") : null;
    if (!consent) setShowCookieBanner(true);
  }, []);

  // Il PIN viene verificato lato server: senza PIN valido l'API non restituisce
  // i dati del preventivo. Il PIN inserito è conservato in sessionStorage e
  // inviato come header a ogni richiesta.
  useEffect(() => {
    const storedPin = sessionStorage.getItem(`pin_${token}`) ?? "";
    fetch(`/api/public/${token}`, {
      headers: storedPin ? { "x-public-pin": storedPin } : undefined,
    })
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
        setSettings(data.settings);

        if (data.requiresPin) {
          sessionStorage.removeItem(`pin_${token}`);
          setState("pin");
          return;
        }
        setQuote(data.quote);
        setState("loaded");
      })
      .catch(() => {
        setErrorType("unknown");
        setState("error");
      });
  }, [token]);

  function acceptCookies() {
    localStorage.setItem("cookie_consent_public", "true");
    setShowCookieBanner(false);
  }

  return (
    <>
      {state === "loading" && <Skeleton />}
      {state === "error" && <ErrorPage error={errorType} />}
      {state === "pin" && (
        <PinScreen
          token={token}
          settings={settings}
          onVerified={async (pin) => {
            sessionStorage.setItem(`pin_${token}`, pin);
            // Ricarica i dati completi: ora il server li restituisce perché
            // il PIN viene inviato come header.
            try {
              const res = await fetch(`/api/public/${token}`, {
                headers: { "x-public-pin": pin },
              });
              const data = await res.json();
              if (res.ok && data.quote) {
                setQuote(data.quote);
                setSettings(data.settings);
                setState("loaded");
              } else {
                setErrorType(data.error ?? "unknown");
                setState("error");
              }
            } catch {
              setErrorType("unknown");
              setState("error");
            }
          }}
        />
      )}
      {state === "loaded" && !quote && <ErrorPage error="unknown" />}
      {state === "loaded" && quote && <QuoteView quote={quote} settings={settings} token={token} />}
      {showCookieBanner && <CookieBanner settings={settings} onAccept={acceptCookies} />}
    </>
  );
}
