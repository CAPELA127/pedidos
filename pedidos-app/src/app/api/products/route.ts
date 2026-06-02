import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const ref = (formData.get('ref') as string | null)?.trim().toUpperCase();
    const name = (formData.get('name') as string | null)?.trim();
    const price = parseFloat(formData.get('price') as string || '0');
    const image = formData.get('image') as File | null;

    if (!ref || !name) {
      return NextResponse.json({ success: false, message: 'Faltan ref o name' }, { status: 400 });
    }

    const supabase = getSupabase();
    let imageUrl: string | null = null;

    // Subir imagen a Supabase Storage si viene
    if (image) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `${ref}-${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl ?? null;
      } else {
        console.warn('Storage upload warning:', uploadErr.message);
      }
    }

    // Guardar en inventario — upsert por referencia
    const row: Record<string, unknown> = {
      Referencia: ref,
      Producto: name,
      'P. Venta': price || null,
    };
    if (imageUrl) row['image_url'] = imageUrl;

    const { error: insertErr } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .upsert([row], { onConflict: 'Referencia' });

    if (insertErr) {
      // Si falla por columna image_url inexistente, reintentar sin ella
      if (insertErr.message?.includes('image_url') || insertErr.code === '42703') {
        delete row['image_url'];
        const { error: retryErr } = await supabase
          .from('INVENTARIO EL PUNTAZO')
          .upsert([row], { onConflict: 'Referencia' });
        if (retryErr) throw retryErr;
      } else {
        throw insertErr;
      }
    }

    return NextResponse.json({ success: true, ref, name, imageUrl });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error guardando producto' },
      { status: 500 }
    );
  }
}
