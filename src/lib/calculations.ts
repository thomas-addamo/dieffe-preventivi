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
  sections: {
    id: string;
    code: string;
    title: string;
    items: Pick<QuoteItem, "total">[];
    isOptional?: boolean | null;
    isOptionalIncluded?: boolean | null;
  }[],
  vatRate: number,
  discountType?: "percent" | "fixed" | null,
  discountValue?: number | null
) {
  const normalSections = sections.filter((s) => !s.isOptional);
  const optionalSections = sections.filter((s) => !!s.isOptional);

  const sectionSubtotals = normalSections.map((s) => ({
    sectionId: s.id,
    code: s.code,
    title: s.title,
    subtotal: calcSectionSubtotal(s.items),
  }));

  const optionalSectionDetails = optionalSections.map((s) => ({
    sectionId: s.id,
    code: s.code,
    title: s.title,
    subtotal: calcSectionSubtotal(s.items),
    isIncluded: !!s.isOptionalIncluded,
  }));

  const baseSubtotal = sectionSubtotals.reduce((sum, s) => sum + s.subtotal, 0);
  const optionalIncludedSubtotal = optionalSectionDetails
    .filter((s) => s.isIncluded)
    .reduce((sum, s) => sum + s.subtotal, 0);

  const subtotalBeforeDiscount = baseSubtotal + optionalIncludedSubtotal;

  let discountAmount = 0;
  if (discountType === "percent" && discountValue) {
    discountAmount = subtotalBeforeDiscount * (discountValue / 100);
  } else if (discountType === "fixed" && discountValue) {
    discountAmount = discountValue;
  }

  const taxableAmount = subtotalBeforeDiscount - discountAmount;
  const vatAmount = taxableAmount * (vatRate / 100);
  const total = taxableAmount + vatAmount;

  return {
    sectionSubtotals,
    baseSubtotal,
    optionalSections: optionalSectionDetails,
    optionalIncludedSubtotal,
    subtotalBeforeDiscount,
    discountAmount,
    taxableAmount,
    vatAmount,
    total,
    subtotal: subtotalBeforeDiscount,
  };
}
