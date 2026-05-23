import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Extrae posibles referencias de un texto OCR
function extractRefs(text: string): string[] {
  const candidates: string[] = [];

  // 1. Patrón explícito: REF: 25872-2 o REF 25872-2
  const explicitRef = text.match(/REF[:\s.#]*([A-Za-z0-9][A-Za-z0-9\-]{2,15})/gi);
  if (explicitRef) {
    explicitRef.forEach(m => {
      const val = m.replace(/^REF[:\s.#]*/i, '').trim();
      if (val) candidates.push(val);
    });
  }

  // 2. Código numérico con guión: 25872-2, 1234-56, etc.
  const numericRef = text.match(/\b\d{3,7}-\d{1,4}\b/g);
  if (numericRef) candidates.push(...numericRef);

  // 3. Alfanumérico con guión tipo PC-35, AB-1234
  const alphaRef = text.match(/\b[A-Z]{1,4}-\d{2,6}\b/g);
  if (alphaRef) candidates.push(...alphaRef);

  // 4. Solo números largos de 5-8 dígitos (fallback)
  const numOnly = text.match(/\b\d{5,8}\b/g);
  if (numOnly) candidates.push(...numOnly);

  // Deduplicar y limpiar
  return [...new Set(candidates.map(c => c.trim().toUpperCase()))];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Tesseract con español + inglés para mejor lectura alfanumérica
    const worker = await createWorker(['spa', 'eng']);
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:. ',
    });
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();

    console.log('OCR raw text:', text);

    const candidates = extractRefs(text);
    console.log('Ref candidates:', candidates);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se detectó ninguna referencia',
        rawText: text
      });
    }

    const supabase = getSupabase();

    // Buscar cada candidato en INVENTARIO EL PUNTAZO
    for (const ref of candidates) {
      // Búsqueda exacta primero
      const { data: exact } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto')
        .eq('Referencia', ref)
        .limit(1);

      if (exact && exact.length > 0) {
        return NextResponse.json({
          success: true,
          data: { ref: exact[0].Referencia, name: exact[0].Producto, rawText: text }
        });
      }

      // Búsqueda flexible (ilike)
      const { data: fuzzy } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto')
        .ilike('Referencia', `%${ref}%`)
        .limit(1);

      if (fuzzy && fuzzy.length > 0) {
        return NextResponse.json({
          success: true,
          data: { ref: fuzzy[0].Referencia, name: fuzzy[0].Producto, rawText: text }
        });
      }
    }

    // No se encontró en inventario — devolver el primer candidato de todas formas
    return NextResponse.json({
      success: true,
      data: { ref: candidates[0], name: 'Producto Desconocido', rawText: text },
      warning: 'Referencia no encontrada en inventario'
    });

  } catch (error) {
    console.error('OCR API Error:', error);
    return NextResponse.json({ success: false, error: 'Error procesando imagen' }, { status: 500 });
  }
}
