import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// IMPORTANTE: usar siempre el model ID con sufijo de fecha — sin sufijo la API falla silenciosamente.
const OCR_MODEL = 'claude-haiku-4-5-20251001';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = (image.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    // Claude Vision extrae referencia, cantidad y precio de la imagen
    const response = await anthropic.messages.create({
      model: OCR_MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Analiza esta imagen de producto y extrae los siguientes datos.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"ref": "...", "quantity": null, "price": null}

Reglas:
- ref: código o referencia del producto (ej: 4162-9, PC-35, 25872-2). Si no encuentras, pon "NINGUNO".
- quantity: número de unidades indicadas en la imagen (número escrito a mano, etiqueta "cant:", "x24", etc). Si no hay, pon null.
- price: precio si aparece explícitamente en la imagen (solo número). Si no hay, pon null.`
          }
        ]
      }]
    });

    const rawText = (response.content[0] as { type: string; text: string }).text.trim();
    const processingTime = Date.now() - startTime;

    let rawRef = 'NINGUNO';
    let detectedQuantity: number | undefined;
    let detectedPrice: number | undefined;

    // Claude a veces envuelve el JSON en ```json ... ``` o agrega texto extra.
    // Extraer el primer objeto JSON que aparezca en la respuesta.
    let jsonText = rawText
      .replace(/^```json\s*/im, '')   // quitar ```json al inicio
      .replace(/^```\s*/im, '')       // quitar ``` al inicio
      .replace(/```\s*$/m, '')        // quitar ``` al final
      .trim();

    // Buscar el bloque JSON con regex como último recurso
    const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonText);
      rawRef = (parsed.ref || 'NINGUNO').toString().trim().toUpperCase();
      if (parsed.quantity != null && !isNaN(parseInt(String(parsed.quantity)))) {
        detectedQuantity = parseInt(String(parsed.quantity));
      }
      if (parsed.price != null && !isNaN(parseFloat(String(parsed.price)))) {
        detectedPrice = parseFloat(String(parsed.price));
      }
    } catch {
      // Fallback real: Claude no devolvió JSON. Intentar extraer la referencia directamente
      // buscando patrones como PTZ-4671, 4162-9, PC-35, etc.
      const refMatch = rawText.match(/\b([A-Z]{1,4}-\d{2,}|\d{4,}-\d+)\b/i);
      rawRef = refMatch ? refMatch[1].toUpperCase() : 'NINGUNO';
    }

    console.log('Claude OCR raw:', rawText.slice(0, 120));
    console.log('Claude OCR resultado:', { rawRef, detectedQuantity, detectedPrice }, `(${processingTime}ms)`);

    if (!rawRef || rawRef === 'NINGUNO') {
      return NextResponse.json({
        success: false,
        error: 'No se detectó ninguna referencia en la imagen',
        processingTime
      });
    }

    const supabase = getSupabase();

    // Búsqueda exacta
    const { data: exact } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .eq('Referencia', rawRef)
      .limit(1);

    if (exact && exact.length > 0) {
      const row = exact[0] as any;
      const inventoryPrice = row['P. Venta'] ? parseFloat(row['P. Venta']) : undefined;
      return NextResponse.json({
        success: true,
        data: {
          ref: row.Referencia,
          name: row.Producto,
          price: inventoryPrice ?? detectedPrice,
          quantity: detectedQuantity
        },
        processingTime
      });
    }

    // Búsqueda flexible
    const { data: fuzzy } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .ilike('Referencia', `%${rawRef}%`)
      .limit(1);

    if (fuzzy && fuzzy.length > 0) {
      const row = fuzzy[0] as any;
      const inventoryPrice = row['P. Venta'] ? parseFloat(row['P. Venta']) : undefined;
      return NextResponse.json({
        success: true,
        data: {
          ref: row.Referencia,
          name: row.Producto,
          price: inventoryPrice ?? detectedPrice,
          quantity: detectedQuantity
        },
        processingTime
      });
    }

    // No está en inventario pero se detectó la referencia
    return NextResponse.json({
      success: true,
      data: { ref: rawRef, name: 'Producto Desconocido', price: detectedPrice, quantity: detectedQuantity },
      warning: 'Referencia no encontrada en inventario',
      processingTime
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('OCR API Error:', msg);
    // Incluir el mensaje real para facilitar diagnóstico en Vercel logs
    return NextResponse.json(
      { success: false, error: 'Error procesando imagen', _debug: msg },
      { status: 500 }
    );
  }
}
