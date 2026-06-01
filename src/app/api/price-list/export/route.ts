import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import ExcelJS from 'exceljs';

export async function GET() {
  const { error } = await requireRole('admin', 'editor');
  if (error) return error;

  const items = await db
    .select()
    .from(priceListItems)
    .orderBy(priceListItems.category, asc(priceListItems.description));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Listino Prezzi');

  sheet.columns = [
    { header: 'Codice', key: 'code', width: 15 },
    { header: 'Descrizione', key: 'description', width: 60 },
    { header: 'U.M.', key: 'unitOfMeasure', width: 12 },
    { header: 'Prezzo Unitario', key: 'unitPrice', width: 18 },
    { header: 'Categoria', key: 'category', width: 25 },
    { header: 'Note', key: 'notes', width: 30 },
    { header: 'Attiva', key: 'isActive', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  for (const item of items) {
    sheet.addRow({
      code: item.code ?? '',
      description: item.description,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: parseFloat(item.unitPrice),
      category: item.category ?? '',
      notes: item.notes ?? '',
      isActive: item.isActive ? 'Sì' : 'No',
    });
  }

  sheet.getColumn('unitPrice').numFmt = '#,##0.00 "€"';

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="listino-prezzi.xlsx"`,
    },
  });
}
