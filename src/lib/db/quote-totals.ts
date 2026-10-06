import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * Imponibile (sezioni incluse, prezzi a corpo, al netto dello sconto, IVA
 * esclusa) di tutti i preventivi, calcolato nel database con un'unica query
 * aggregata: niente download di tutte le voci per sommarle in JavaScript.
 */
export async function getQuoteNetTotals(): Promise<Map<string, number>> {
  const res = await db.execute<{ id: string; gross: string | number | null; discount_type: string | null; discount_value: number | null }>(sql`
    select q.id, coalesce(g.gross, 0) as gross, q.discount_type, q.discount_value
    from quotes q
    left join (
      select s.quote_id,
             sum(case when s.lump_sum then coalesce(s.lump_sum_price, 0) else coalesce(i.total, 0) end) as gross
      from quote_sections s
      left join (
        select section_id, sum(total) as total from quote_items group by section_id
      ) i on i.section_id = s.id
      where not (s.is_optional and not s.is_optional_included)
      group by s.quote_id
    ) g on g.quote_id = q.id
    where q.deleted_at is null`);

  const totals = new Map<string, number>();
  for (const r of res.rows) {
    const gross = Number(r.gross) || 0;
    const discount =
      r.discount_type === "percent" && r.discount_value
        ? gross * (r.discount_value / 100)
        : r.discount_type === "fixed" && r.discount_value
          ? r.discount_value
          : 0;
    totals.set(r.id, Math.max(0, gross - discount));
  }
  return totals;
}
