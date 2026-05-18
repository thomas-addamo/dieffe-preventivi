import React from "react";
import { render } from "@react-email/render";
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
  console.log('[SEND-FN] sendSignatureNotification called', {
    to: params.recipientEmail,
    hasApiKey: !!process.env.RESEND_API_KEY,
  });

  const { action, quoteCode, signerName } = params;
  const subject =
    action === "accepted"
      ? `✅ Preventivo ${quoteCode} accettato da ${signerName}`
      : `❌ Preventivo ${quoteCode} rifiutato`;

  const html = await render(
    React.createElement(QuoteSignedEmail, {
      quoteCode: params.quoteCode,
      quoteTitle: params.quoteTitle,
      quoteId: params.quoteId,
      signerName: params.signerName,
      action: params.action,
      signedAt: params.signedAt,
      ipAddress: params.ipAddress,
      appUrl: env.APP_URL,
    })
  );

  console.log('[SEND-FN] About to call resend.emails.send (admin)');
  const { data, error } = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.recipientEmail,
    subject,
    html,
  });

  if (error) {
    console.error('[SEND-FN] Resend returned error (admin):', JSON.stringify(error));
    throw new Error(`Resend error: ${(error as { message?: string }).message ?? JSON.stringify(error)}`);
  }

  console.log('[SEND-FN] ✅ Resend success (admin):', (data as { id?: string })?.id);
  return data;
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
  console.log('[SEND-FN] sendClientSignatureConfirmation called', {
    to: params.signerEmail,
    hasApiKey: !!process.env.RESEND_API_KEY,
  });

  const isAccepted = params.action === "accepted";
  const subject = isAccepted
    ? `Preventivo ${params.quoteCode} — Conferma di accettazione`
    : `Preventivo ${params.quoteCode} — Conferma di rifiuto`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments: any[] = [];
  if (isAccepted) {
    console.log('[SEND-FN] Generating PDF attachment for quoteId:', params.quoteId);
    const pdfBuffer = await generateQuotePdfBuffer(params.quoteId, { includeIp: false });
    console.log('[SEND-FN] PDF generated, size bytes:', pdfBuffer.length);
    attachments.push({
      filename: `${params.quoteCode}_preventivo_firmato.pdf`,
      content: pdfBuffer.toString("base64"),
    });
  }

  const fromAddress = params.fromEmail || env.RESEND_FROM_EMAIL;

  const htmlCliente = await render(
    React.createElement(ClientSignatureConfirmationEmail, {
      quoteCode: params.quoteCode,
      quoteTitle: params.quoteTitle,
      signerName: params.signerName,
      action: params.action,
      signedAt: params.signedAt,
      companyEmail: params.companyEmail,
      companyPhone: params.companyPhone,
      companyWebsite: params.companyWebsite,
      companyName: params.companyName,
    })
  );

  console.log('[SEND-FN] About to call resend.emails.send (client)', {
    from: `${params.companyName} <${fromAddress}>`,
    to: params.signerEmail,
    attachmentsCount: attachments.length,
  });

  const { data, error } = await getResend().emails.send({
    from: `${params.companyName} <${fromAddress}>`,
    to: params.signerEmail,
    subject,
    html: htmlCliente,
    attachments,
  });

  if (error) {
    console.error('[SEND-FN] Resend returned error (client):', JSON.stringify(error));
    throw new Error(`Resend error: ${(error as { message?: string }).message ?? JSON.stringify(error)}`);
  }

  console.log('[SEND-FN] ✅ Resend success (client):', (data as { id?: string })?.id);
  return data;
}
