import { Resend } from "resend";
import { env } from "../env";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY || "placeholder_not_configured");
  }
  return _resend;
}

