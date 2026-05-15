import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');

  let ip = forwarded?.split(',')[0].trim() ?? realIp ?? null;

  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
    if (process.env.NODE_ENV === 'development') {
      ip = '203.0.113.42'; // RFC 5737 test address for local dev
    } else {
      ip = null;
    }
  }

  return NextResponse.json({
    ip,
    dev: process.env.NODE_ENV === 'development',
  });
}

export const runtime = 'nodejs';
