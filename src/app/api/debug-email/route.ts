import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    resendKeyPresent: !!process.env.RESEND_API_KEY,
    resendKeyPrefix: process.env.RESEND_API_KEY?.slice(0, 10) ?? 'MISSING',
    fromEmail: process.env.RESEND_FROM_EMAIL ?? 'MISSING',
    appUrl: process.env.APP_URL ?? 'MISSING',
    nodeEnv: process.env.NODE_ENV,
  });
}
