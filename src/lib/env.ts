import { z } from "zod";

const envSchema = z.object({
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("onboarding@resend.dev"),
  // Invio dei preventivi ai clienti dalla casella ufficiale (Gmail SMTP con
  // password per le app: https://myaccount.google.com/apppasswords).
  GMAIL_USER: z.string().default("impresa.dieffe@gmail.com"),
  GMAIL_APP_PASSWORD: z.string().default(""),
  APP_URL: z.string().default("http://localhost:3847"),
  GEMINI_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
});

export const env = envSchema.parse(process.env);
