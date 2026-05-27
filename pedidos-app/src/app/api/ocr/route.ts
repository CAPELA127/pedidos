import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

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

    // Claude Vision extrae la referencia del producto
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Extrae SOLO el código o referencia del producto en esta imagen.
El formato suele ser: números con guión (ej: 4162-9, 25872-2) o letras+números (ej: PC-35).
Responde ÚNICAMENTE con el código, sin texto adicional.
Si hay varios, el más prominente o el que parece ser la referencia principal.
Si no encuentras ningún código, responde: NINGUNO`
          }
        ]
      }]
    });

    const rawRef = (response.content[0] as { type: string; text: string }).text.trim().toUpperCase();
    const processingTime = Date.now() - startTime;

    console.log('Claude OCR resultado:', rawRef, `(${processingTime}ms)`);

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
      return NextResponse.json({
        success: true,
        data: { ref: row.Referencia, name: row.Producto, price: row['P. Venta'] ? parseFloat(row['P. Venta']) : undefined },
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
      return NextResponse.json({
        success: true,
        data: { ref: row.Referencia, name: row.Producto, price: row['P. Venta'] ? parseFloat(row['P. Venta']) : undefined },
        processingTime
      });
    }

    // No está en inventario pero se detectó la referencia
    return NextResponse.json({
      success: true,
      data: { ref: rawRef, name: 'Producto Desconocido' },
      warning: 'Referencia no encontrada en inventario',
      processingTime
    });

  } catch (error) {
    console.error('OCR API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando imagen' },
      { status: 500 }
    );
  }
}
