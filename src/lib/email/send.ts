import React from "react";
import { getResend } from "./client";
import { QuoteSignedEmail } from "./templates/quote-signed";
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
