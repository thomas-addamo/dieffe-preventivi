import React from "react";
import { getResend } from "./client";
import { QuoteSignedEmail } from "./templates/quote-signed";
import { ClientSignatureConfirmationEmail } from "./templates/client-signature-confirmation";
import { generateQuotePdfBuffer } from "@/lib/exporters/pdf";
import { env } from "../env";

export async function sendSignatureNotification(params: {
  quoteCode: string;
  quoteTitle: string;
  quoteId: string;
  signerName: string;
  action: "accepted" | "rejected";
  signedAt: Date;
  ipAddress: string | null;
  recipientEmail: string;
}) {
  const { action, quoteCode, signerName } = params;
  const subject =
    action === "accepted"
      ? `✅ Preventivo ${quoteCode} accettato da ${signerName}`
      : `❌ Preventivo ${quoteCode} rifiutato`;

  await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.recipientEmail,
    subject,
    react: React.createElement(QuoteSignedEmail, {
      quoteCode: params.quoteCode,
      quoteTitle: params.quoteTitle,
      quoteId: params.quoteId,
      signerName: params.signerName,
      action: params.action,
      signedAt: params.signedAt,
      ipAddress: params.ipAddress,
      appUrl: env.APP_URL,
    }),
  });
}

export async function sendClientSignatureConfirmation(params: {
  quoteId: string;
  quoteCode: string;
  quoteTitle: string;
  signerName: string;
  signerEmail: string;
  action: "accepted" | "rejected";
  signedAt: Date;
  fromEmail: string;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
}) {
  const isAccepted = params.action === "accepted";
  const subject = isAccepted
    ? `Preventivo ${params.quoteCode} — Conferma di accettazione`
    : `Preventivo ${params.quoteCode} — Conferma di rifiuto`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments: any[] = [];
  if (isAccepted) {
    const pdfBuffer = await generateQuotePdfBuffer(params.quoteId, { includeIp: false });
    attachments.push({
      filename: `${params.quoteCode}_preventivo_firmato.pdf`,
      content: pdfBuffer.toString("base64"),
    });
  }

  const fromAddress = params.fromEmail || env.RESEND_FROM_EMAIL;

  await getResend().emails.send({
    from: `${params.companyName} <${fromAddress}>`,
    to: params.signerEmail,
    subject,
    react: React.createElement(ClientSignatureConfirmationEmail, {
      quoteCode: params.quoteCode,
      quoteTitle: params.quoteTitle,
      signerName: params.signerName,
      action: params.action,
      signedAt: params.signedAt,
      companyEmail: params.companyEmail,
      companyPhone: params.companyPhone,
      companyWebsite: params.companyWebsite,
      companyName: params.companyName,
    }),
    attachments,
  });
}
