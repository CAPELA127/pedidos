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

    // Guardar en inventario — la tabla no tiene constraint UNIQUE en Referencia,
    // así que no se puede usar upsert(onConflict). Hacemos select -> update/insert manual.
    const row: Record<string, unknown> = {
      Referencia: ref,
      Producto: name,
      'P. Venta': price || null,
    };
    if (imageUrl) row['image_url'] = imageUrl;

    // Identidad = Referencia + Descripción (Producto).
    // Se permiten referencias repetidas con descripciones distintas (cada una es una fila).
    // Solo se actualiza cuando coinciden referencia Y descripción exactas.
    const { data: existing } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('id_producto')
      .eq('Referencia', ref)
      .eq('Producto', name)
      .limit(1)
      .maybeSingle();

    const writeRow = async (r: Record<string, unknown>) => {
      if (existing) {
        // Actualiza solo esa fila por su id_producto (no toca otras filas con misma ref)
        const { Referencia, Producto, ...updateFields } = r;
        return supabase
          .from('INVENTARIO EL PUNTAZO')
          .update(updateFields)
          .eq('id_producto', existing.id_producto as number);
      }
      // id_producto es NOT NULL sin default → calcular el siguiente manualmente
      const { data: maxRow } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('id_producto')
        .order('id_producto', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextId = ((maxRow?.id_producto as number | null) ?? 0) + 1;
      return supabase
        .from('INVENTARIO EL PUNTAZO')
        .insert([{ id_producto: nextId, ...r }]);
    };

    const { error: writeErr } = await writeRow(row);

    if (writeErr) {
      // Si falla por columna image_url inexistente, reintentar sin ella
      if (writeErr.message?.includes('image_url') || writeErr.code === '42703') {
        delete row['image_url'];
        const { error: retryErr } = await writeRow(row);
        if (retryErr) throw retryErr;
      } else {
        throw writeErr;
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
