import { z } from "zod";

const envSchema = z.object({
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("onboarding@resend.dev"),
  APP_URL: z.string().default("http://localhost:3847"),
});

export const env = envSchema.parse(process.env);
