import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: `Dieffe Test <${process.env.RESEND_FROM_EMAIL}>`,
      to: 'thomas.addamo08@gmail.com',
      subject: 'Test da Vercel route',
      html: '<p>Test email da route Vercel. Se la ricevi, Resend funziona in produzione.</p>',
    });

    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
