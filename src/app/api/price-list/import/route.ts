import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/guard';
import { db } from '@/lib/db/client';
import { priceListItems } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole('admin', 'editor');
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Nessun file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name.toLowerCase();

  let rows: Array<{ description: string; unitOfMeasure: string; unitPrice: string; code?: string; category?: string }> = [];

  try {
    if (filename.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      const lines = text.split('\n').filter(Boolean);
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

      const colIndex = {
        description: header.findIndex((h) => h.includes('descriz')),
        unitOfMeasure: header.findIndex((h) => h.includes('u.m') || h.includes('unita') || h.includes('misura')),
        unitPrice: header.findIndex((h) => h.includes('prezzo') || h.includes('price')),
        code: header.findIndex((h) => h.includes('codice') || h.includes('code')),
        category: header.findIndex((h) => h.includes('categor')),
      };

      if (colIndex.description === -1 || colIndex.unitPrice === -1) {
        return NextResponse.json({ error: 'Colonne obbligatorie mancanti: descrizione, prezzo' }, { status: 400 });
      }

      for (const line of lines.slice(1)) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const desc = cols[colIndex.description];
        const um = colIndex.unitOfMeasure >= 0 ? cols[colIndex.unitOfMeasure] : 'n°';
        const price = cols[colIndex.unitPrice];
        if (!desc || !price) continue;
        rows.push({
          description: desc,
          unitOfMeasure: um || 'n°',
          unitPrice: price.replace(',', '.'),
          code: colIndex.code >= 0 ? cols[colIndex.code] || undefined : undefined,
          category: colIndex.category >= 0 ? cols[colIndex.category] || undefined : undefined,
        });
      }
    } else {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];

      const header: string[] = [];
      sheet.getRow(1).eachCell((cell) => {
        header.push(String(cell.value ?? '').toLowerCase().trim());
      });

      const colIndex = {
        description: header.findIndex((h) => h.includes('descriz')),
        unitOfMeasure: header.findIndex((h) => h.includes('u.m') || h.includes('unita') || h.includes('misura')),
        unitPrice: header.findIndex((h) => h.includes('prezzo') || h.includes('price')),
        code: header.findIndex((h) => h.includes('codice') || h.includes('code')),
        category: header.findIndex((h) => h.includes('categor')),
      };

      if (colIndex.description === -1 || colIndex.unitPrice === -1) {
        return NextResponse.json({ error: 'Colonne obbligatorie mancanti: descrizione, prezzo' }, { status: 400 });
      }

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const getVal = (idx: number) => (idx >= 0 ? String(row.getCell(idx + 1).value ?? '').trim() : '');
        const desc = getVal(colIndex.description);
        const price = getVal(colIndex.unitPrice).replace(',', '.');
        if (!desc || !price || isNaN(parseFloat(price))) return;
        rows.push({
          description: desc,
          unitOfMeasure: getVal(colIndex.unitOfMeasure) || 'n°',
          unitPrice: price,
          code: getVal(colIndex.code) || undefined,
          category: getVal(colIndex.category) || undefined,
        });
      });
    }
  } catch {
    return NextResponse.json({ error: 'Errore parsing file' }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nessuna voce trovata nel file' }, { status: 400 });
  }

  const preview = rows.slice(0, 5);
  const confirm = formData.get('confirm') === 'true';

  if (!confirm) {
    return NextResponse.json({ preview, count: rows.length });
  }

  await db.insert(priceListItems).values(
    rows.map((r) => ({
      description: r.description,
      unitOfMeasure: r.unitOfMeasure,
      unitPrice: r.unitPrice,
      code: r.code ?? null,
      category: r.category ?? null,
      isActive: true,
      createdBy: session!.user.id,
    }))
  );

  return NextResponse.json({ imported: rows.length });
}
