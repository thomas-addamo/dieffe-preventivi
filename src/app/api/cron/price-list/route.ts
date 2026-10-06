import { NextResponse } from "next/server";
import { runPriceListMaintenance } from "@/lib/price-list/maintenance";

// Riordino automatico giornaliero del listino (Vercel Cron, vedi vercel.json).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await runPriceListMaintenance({ trigger: "auto" });
  return NextResponse.json(report);
}
