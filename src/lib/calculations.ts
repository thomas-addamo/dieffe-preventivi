import type { QuoteItem } from "@/lib/db/schema";

export function calcItemTotal(
  quantity: number,
  unitPrice: number,
  discount: number
): number {
  const subtotal = quantity * unitPrice;
  return subtotal - subtotal * (discount / 100);
}

export function calcSectionSubtotal(items: Pick<QuoteItem, "total">[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

export function calcQuoteTotals(
  sections: { items: Pick<QuoteItem, "total">[] }[],
  vatRate: number,
  discountType?: "percent" | "fixed" | null,
  discountValue?: number | null
) {
  const subtotal = sections.reduce(
    (sum, s) => sum + calcSectionSubtotal(s.items),
    0
  );

  let discountAmount = 0;
  if (discountType === "percent" && discountValue) {
    discountAmount = subtotal * (discountValue / 100);
  } else if (discountType === "fixed" && discountValue) {
    discountAmount = discountValue;
  }

  const taxableAmount = subtotal - discountAmount;
  const vatAmount = taxableAmount * (vatRate / 100);
  const total = taxableAmount + vatAmount;

  return { subtotal, discountAmount, taxableAmount, vatAmount, total };
}
