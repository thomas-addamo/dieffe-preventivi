import "server-only";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "../env";

// Invio dalla casella ufficiale dell'impresa tramite il server SMTP di Gmail
// (password per le app). Gmail salva da sé ogni messaggio in "Inviati" e le
// risposte dei clienti arrivano nella stessa casella.

let transporter: nodemailer.Transporter | null = null;

export function isGmailConfigured(): boolean {
  return !!env.GMAIL_USER && !!env.GMAIL_APP_PASSWORD;
}

export function gmailAddress(): string {
  return env.GMAIL_USER;
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
  }
  return transporter;
}

export async function sendGmail(
  message: Omit<Mail.Options, "from"> & { fromName: string }
): Promise<{ messageId: string }> {
  const { fromName, ...rest } = message;
  const info = await getTransporter().sendMail({
    ...rest,
    from: { name: fromName, address: env.GMAIL_USER },
  });
  return { messageId: info.messageId };
}
