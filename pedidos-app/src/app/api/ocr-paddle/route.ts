import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function validateImage(buffer: Buffer, filename: string) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (buffer.length > maxSize) {
    throw new Error(`Imagen muy grande. Máximo 10MB`);
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!ext || !validExts.includes(ext)) {
    throw new Error(`Formato no soportado. Usa JPG, PNG o WebP`);
  }

  return true;
}

function getMimeType(filename: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    validateImage(buffer, image.name);

    const base64Image = buffer.toString('base64');
    const mimeType = getMimeType(image.name);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analiza esta imagen de un producto y extrae:
1. REFERENCIA: El código de referencia del producto (puede ser formato como "4031-3", "25872-2", "ABC-123", número solo, etc.)
2. PRECIO: El precio en pesos colombianos si aparece (puede estar como "COP 25.200", "$25200", "25.200", etc.)

Responde SOLO en este formato JSON, sin explicaciones:
{"ref": "CODIGO_AQUI", "price": NUMERO_O_NULL}

Si no encuentras referencia, usa null. Si no encuentras precio, usa null.
Ejemplos de referencias válidas: "4031-3", "25872", "AB-456", "123456"`,
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('Claude Vision response:', rawText);

    let ref: string | null = null;
    let price: number | null = null;

    try {
      const jsonMatch = rawText.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        ref = parsed.ref && parsed.ref !== 'null' ? String(parsed.ref).trim().toUpperCase() : null;
        price = parsed.price && typeof parsed.price === 'number' ? parsed.price : null;
      }
    } catch {
      console.log('JSON parse failed, trying regex on raw text');
      const refMatch = rawText.match(/["']ref["']\s*:\s*["']([^"']+)["']/i);
      if (refMatch) ref = refMatch[1].trim().toUpperCase();
      const priceMatch = rawText.match(/["']price["']\s*:\s*(\d+)/i);
      if (priceMatch) price = parseInt(priceMatch[1], 10);
    }

    console.log('Extracted ref:', ref, 'price:', price);

    if (!ref) {
      return NextResponse.json({
        success: false,
        error: 'No se detectó ninguna referencia en la imagen',
        rawText,
      });
    }

    const supabase = getSupabase();

    // Búsqueda exacta
    const { data: exact } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .eq('Referencia', ref)
      .limit(1);

    if (exact && exact.length > 0) {
      const row = exact[0] as any;
      const dbPrice = row['P. Venta'] ? parseFloat(row['P. Venta']) : null;
      return NextResponse.json({
        success: true,
        data: { ref: row.Referencia, name: row.Producto, price: dbPrice ?? price, rawText },
        confidence: 95,
        processingTime: Date.now() - startTime,
      });
    }

    // Búsqueda fuzzy
    const { data: fuzzy } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .ilike('Referencia', `%${ref}%`)
      .limit(1);

    if (fuzzy && fuzzy.length > 0) {
      const row = fuzzy[0] as any;
      const dbPrice = row['P. Venta'] ? parseFloat(row['P. Venta']) : null;
      return NextResponse.json({
        success: true,
        data: { ref: row.Referencia, name: row.Producto, price: dbPrice ?? price, rawText },
        confidence: 75,
        processingTime: Date.now() - startTime,
      });
    }

    // Fallback: referencia detectada pero no en inventario
    return NextResponse.json({
      success: true,
      data: { ref, name: 'Producto Desconocido', price, rawText },
      confidence: 60,
      processingTime: Date.now() - startTime,
      warning: 'Referencia no encontrada en inventario',
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Error procesando imagen';
    console.error('OCR error:', errorMsg);

    return NextResponse.json(
      { success: false, error: errorMsg, processingTime },
      { status: 200 }
    );
  }
}
