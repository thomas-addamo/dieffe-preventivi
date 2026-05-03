import ExcelJS from "exceljs";
import type { QuoteWithRelations } from "@/types";
import type { CompanySettings } from "@/lib/db/schema";
import { calcQuoteTotals, calcSectionSubtotal } from "@/lib/calculations";
import { formatDate } from "@/lib/utils";

export async function exportToExcel(
  quote: QuoteWithRelations,
  settings: CompanySettings | null
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = settings?.companyName ?? "Dieffe Preventivi";
  wb.created = new Date();

  const ws = wb.addWorksheet("Preventivo", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true },
  });

  const primary = settings?.primaryColor ?? "#1e40af";
  const primaryHex = primary.replace("#", "");
  const sectionBg = "dbeafe"; // blue-100

  // column widths
  ws.columns = [
    { key: "num", width: 8 },
    { key: "desc", width: 45 },
    { key: "um", width: 10 },
    { key: "qty", width: 10 },
    { key: "price", width: 14 },
    { key: "disc", width: 10 },
    { key: "total", width: 16 },
  ];

  let row = 1;

  // Header
  ws.mergeCells(`A${row}:G${row}`);
  const titleCell = ws.getCell(`A${row}`);
  titleCell.value = settings?.companyName ?? "Dieffe Ristrutturazioni";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF" + primaryHex } };
  titleCell.alignment = { horizontal: "left" };
  row++;

  if (settings?.address) {
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = settings.address;
    ws.getCell(`A${row}`).font = { size: 10, color: { argb: "FF555555" } };
    row++;
  }

  ws.mergeCells(`A${row}:G${row}`);
  const info = [settings?.vatNumber, settings?.email, settings?.phone, settings?.website]
    .filter(Boolean)
    .join("  |  ");
  ws.getCell(`A${row}`).value = info;
  ws.getCell(`A${row}`).font = { size: 9, color: { argb: "FF777777" } };
  row += 2;

  // Preventivo info
  const infoRows: [string, string][] = [
    ["Preventivo N.", quote.code],
    ["Titolo", quote.title],
    ["Data", formatDate(quote.createdAt)],
    ["Cliente", quote.client?.name ?? ""],
    ["Cantiere", quote.projectAddress ?? ""],
  ];
  if (quote.validUntil) infoRows.push(["Valido fino al", formatDate(quote.validUntil)]);

  for (const [label, value] of infoRows) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true, size: 10 };
    ws.mergeCells(`B${row}:G${row}`);
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { size: 10 };
    row++;
  }
  row++;

  // Table header
  const headers = ["N.", "Descrizione", "U.M.", "Qta", "Prezzo unit.", "Sconto %", "Totale"];
  const headerRow = ws.getRow(row);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + primaryHex } };
    cell.alignment = { horizontal: i > 2 ? "right" : "left", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
    };
  });
  headerRow.height = 22;
  row++;

  // Sections and items
  const sectionStartRows: number[] = [];
  const sectionEndRows: number[] = [];

  for (const section of quote.sections) {
    // section header
    const secRow = ws.getRow(row);
    ws.mergeCells(`A${row}:G${row}`);
    const secCell = secRow.getCell(1);
    secCell.value = `${section.code} — ${section.title}`;
    secCell.font = { bold: true, size: 10 };
    secCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + sectionBg } };
    secCell.alignment = { horizontal: "left", vertical: "middle" };
    secRow.height = 18;
    sectionStartRows.push(row);
    row++;

    const itemStartRow = row;

    for (let idx = 0; idx < section.items.length; idx++) {
      const item = section.items[idx];
      const itemRow = ws.getRow(row);
      const isEven = idx % 2 === 1;

      const totalFormula = `=D${row}*E${row}*(1-F${row}/100)`;

      const cells = [
        `${section.code}.${idx + 1}`,
        item.description,
        item.unitOfMeasure,
        item.quantity,
        item.unitPrice,
        item.discount,
        { formula: totalFormula, result: item.total },
      ];

      cells.forEach((val, i) => {
        const cell = itemRow.getCell(i + 1);
        cell.value = val as ExcelJS.CellValue;
        if (isEven) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        }
        if (i >= 3) {
          cell.alignment = { horizontal: "right" };
          if (i === 4 || i === 6) {
            cell.numFmt = '#,##0.00 "€"';
          } else if (i === 5) {
            cell.numFmt = '0.00"%"';
          }
        }
        cell.font = { size: 9 };
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE4E4E7" } },
        };
      });

      itemRow.height = 16;
      row++;
    }

    sectionEndRows.push(row - 1);

    // section subtotal
    if (section.items.length > 0) {
      const subRow = ws.getRow(row);
      ws.mergeCells(`A${row}:F${row}`);
      subRow.getCell(1).value = `Subtotale ${section.code}`;
      subRow.getCell(1).font = { bold: true, size: 9, italic: true };
      subRow.getCell(1).alignment = { horizontal: "right" };
      subRow.getCell(7).value = { formula: `=SUM(G${itemStartRow}:G${row - 1})`, result: calcSectionSubtotal(section.items) };
      subRow.getCell(7).numFmt = '#,##0.00 "€"';
      subRow.getCell(7).font = { bold: true, size: 9 };
      subRow.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
      row++;
    }
    row++;
  }

  // Totals
  const totals = calcQuoteTotals(
    quote.sections,
    quote.vatRate,
    quote.discountType,
    quote.discountValue
  );

  row++;
  const totalsData: [string, number, string][] = [
    ["Subtotale", totals.subtotal, '#,##0.00 "€"'],
  ];
  if (totals.discountAmount > 0) {
    totalsData.push(["Sconto", -totals.discountAmount, '#,##0.00 "€"']);
    totalsData.push(["Imponibile", totals.taxableAmount, '#,##0.00 "€"']);
  }
  totalsData.push([`IVA ${quote.vatRate}%`, totals.vatAmount, '#,##0.00 "€"']);
  totalsData.push(["TOTALE", totals.total, '#,##0.00 "€"']);

  for (const [label, value, fmt] of totalsData) {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: label === "TOTALE", size: 10 };
    ws.getCell(`A${row}`).alignment = { horizontal: "right" };
    ws.getCell(`G${row}`).value = value;
    ws.getCell(`G${row}`).numFmt = fmt;
    ws.getCell(`G${row}`).font = { bold: label === "TOTALE", size: label === "TOTALE" ? 12 : 10 };
    if (label === "TOTALE") {
      ws.getCell(`G${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + primaryHex } };
      ws.getCell(`G${row}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    }
    row++;
  }

  // Payment terms
  if (quote.paymentTerms) {
    row++;
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "Condizioni di pagamento: " + quote.paymentTerms;
    ws.getCell(`A${row}`).font = { size: 9, italic: true, color: { argb: "FF555555" } };
    ws.getCell(`A${row}`).alignment = { wrapText: true };
  }

  // Summary sheet
  const ws2 = wb.addWorksheet("Riepilogo");
  ws2.columns = [
    { key: "section", width: 30 },
    { key: "total", width: 16 },
  ];
  ws2.addRow(["Sezione", "Totale"]).font = { bold: true };
  for (const section of quote.sections) {
    ws2.addRow([
      `${section.code} — ${section.title}`,
      calcSectionSubtotal(section.items),
    ]).getCell(2).numFmt = '#,##0.00 "€"';
  }
  ws2.addRow([]);
  ws2.addRow(["Subtotale", totals.subtotal]).getCell(2).numFmt = '#,##0.00 "€"';
  ws2.addRow([`IVA ${quote.vatRate}%`, totals.vatAmount]).getCell(2).numFmt = '#,##0.00 "€"';
  const totalRow2 = ws2.addRow(["TOTALE", totals.total]);
  totalRow2.font = { bold: true };
  totalRow2.getCell(2).numFmt = '#,##0.00 "€"';

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
