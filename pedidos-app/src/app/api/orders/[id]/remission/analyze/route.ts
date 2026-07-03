import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Lectura de hojas manuscritas con resaltador: requiere el modelo más capaz en visión.
const ANALYZE_MODEL = 'claude-opus-4-8';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const REMISSION_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Referencia del producto tal como aparece en el pedido original, o la referencia manuscrita si es un producto agregado' },
          name: { type: 'string', description: 'Nombre del producto' },
          packed_quantity: { type: 'integer', description: 'Cantidad realmente empacada. 0 si está resaltado (agotado). La cantidad original si solo tiene chulo. El número manuscrito si fue modificado.' },
          status: { type: 'string', enum: ['completo', 'modificado', 'agotado', 'agregado'], description: 'completo: chulo sin cambios. modificado: número manuscrito distinto. agotado: fila resaltada con resaltador. agregado: línea manuscrita nueva al final.' },
          unit_type: { type: 'string', enum: ['unidad', 'docena', 'box'], description: 'Tipo de unidad. Para agregados, lo que diga el manuscrito; si no dice, unidad.' },
          note: { type: 'string', description: 'Anotación manuscrita relevante junto a la fila, si la hay. Cadena vacía si no.' }
        },
        required: ['ref', 'name', 'packed_quantity', 'status', 'unit_type', 'note'],
        additionalProperties: false
      }
    },
    packing: {
      type: 'object',
      description: 'Datos de la hoja CONTROL DE EMPAQUE Y ENVÍO si aparece en las fotos. Campos vacíos si no aparece.',
      properties: {
        packer_name: { type: 'string' },
        verifier_name: { type: 'string' },
        packing_time: { type: 'string' },
        packing_location: { type: 'string' },
        packing_date: { type: 'string' },
        boxes_count: { type: ['integer', 'null'] }
      },
      required: ['packer_name', 'verifier_name', 'packing_time', 'packing_location', 'packing_date', 'boxes_count'],
      additionalProperties: false
    }
  },
  required: ['items', 'packing'],
  additionalProperties: false
} as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const formData = await request.formData();
    const images = formData.getAll('images') as File[];

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No se recibieron imágenes' },
        { status: 400 }
      );
    }

    // Traer los items del pedido original — la IA compara contra esta lista, no lee de cero
    const { data: orderItems, error: itemsErr } = await getSupabase()
      .from('order_items')
      .select('product_ref, product_name, quantity, price_at_time, unit_type, notes')
      .eq('order_id', orderId)
      .order('created_at');

    if (itemsErr) throw itemsErr;
    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { success: false, message: `El pedido ${orderId} no existe o no tiene items` },
        { status: 404 }
      );
    }

    const originalList = orderItems
      .map((oi, i) => `${i + 1}. REF: ${oi.product_ref} | ${oi.product_name} | Cant: ${oi.quantity} | ${oi.unit_type || 'unidad'}${oi.notes ? ` | Nota: ${oi.notes}` : ''}`)
      .join('\n');

    const imageBlocks = await Promise.all(
      images.map(async (img) => {
        const buf = Buffer.from(await img.arrayBuffer());
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: (img.type || 'image/jpeg') as ImageMediaType,
            data: buf.toString('base64')
          }
        };
      })
    );

    const response = await anthropic.messages.create({
      model: ANALYZE_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        format: { type: 'json_schema', schema: REMISSION_SCHEMA as unknown as Record<string, unknown> }
      },
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `Estas fotos son las hojas impresas del pedido ${orderId} DESPUÉS de que bodega lo empacó, con modificaciones manuscritas.

PEDIDO ORIGINAL (lista de referencia — compara cada fila de las fotos contra esto):
${originalList}

REGLAS DE INTERPRETACIÓN DE LAS MARCAS:
1. Fila RESALTADA con resaltador (naranja, rosado, o cualquier color) = referencia AGOTADA, no se empacó ni una unidad → packed_quantity: 0, status: "agotado".
2. Número MANUSCRITO encima o al lado de la cantidad impresa = cantidad real empacada → packed_quantity: ese número, status: "modificado". Lee el número con cuidado (pueden ser correcciones sobre la cifra impresa).
3. Chulo/visto (✓) sin número manuscrito = se empacó completo → packed_quantity: la cantidad original de la lista, status: "completo".
4. Líneas MANUSCRITAS al final (referencias que no están en la lista original, o repetidas con cantidad extra) = productos AGREGADOS → status: "agregado", packed_quantity: la cantidad manuscrita. Transcribe la referencia manuscrita lo más fiel posible.
5. Si una fila no tiene ninguna marca visible, asume status "completo" con la cantidad original.
6. Si hay una hoja de "CONTROL DE EMPAQUE Y ENVÍO", extrae sus datos manuscritos en "packing" (nombres, hora, cámara/bodega, fecha, número de cajas — el número de cajas puede estar escrito a mano en lugar de marcado en las casillas).

Devuelve TODOS los items del pedido original (los 39 o los que sean), cada uno con su estado, MÁS los agregados manuscritos. Usa exactamente las REF de la lista original para los items existentes.`
          }
        ]
      }]
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { success: false, message: 'El modelo no pudo procesar las imágenes' },
        { status: 502 }
      );
    }

    const textBlock = response.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!textBlock) throw new Error('Respuesta sin contenido');

    const parsed = JSON.parse(textBlock.text) as {
      items: Array<{ ref: string; name: string; packed_quantity: number; status: string; unit_type: string; note: string }>;
      packing: { packer_name: string; verifier_name: string; packing_time: string; packing_location: string; packing_date: string; boxes_count: number | null };
    };

    // Enriquecer con datos del pedido original (precio, cantidad pedida).
    // La IA puede transcribir la REF con diferencias (espacios, sufijos recortados),
    // así que el cruce no puede ser solo por igualdad exacta.
    type OrderItem = typeof orderItems[number];
    const norm = (s: string) => String(s).toUpperCase().trim().replace(/\s+/g, ' ');
    const originalByRef = new Map<string, OrderItem>(orderItems.map(oi => [norm(oi.product_ref), oi]));
    // Índice por primer token de la REF (ej. "PTZ-0300" de "PTZ-0300 JUGUETE PISTOLA"),
    // solo cuando el token identifica un único item
    const byFirstToken = new Map<string, OrderItem | null>();
    for (const oi of orderItems) {
      const tok = norm(oi.product_ref).split(' ')[0];
      byFirstToken.set(tok, byFirstToken.has(tok) ? null : oi);
    }
    const byName = new Map<string, OrderItem | null>();
    for (const oi of orderItems) {
      const n = norm(oi.product_name || '');
      if (n) byName.set(n, byName.has(n) ? null : oi);
    }
    const findOriginal = (ref: string, name: string): OrderItem | undefined => {
      const n = norm(ref);
      const exact = originalByRef.get(n);
      if (exact) return exact;
      const tokenMatch = byFirstToken.get(n.split(' ')[0]);
      if (tokenMatch) return tokenMatch;
      // Una REF prefijo de la otra (la IA recortó o alargó el texto)
      const prefixCandidates = orderItems.filter(oi => {
        const on = norm(oi.product_ref);
        return n.length >= 3 && (on.startsWith(n) || n.startsWith(on));
      });
      if (prefixCandidates.length === 1) return prefixCandidates[0];
      // Último recurso: nombre de producto idéntico y único
      const nameMatch = byName.get(norm(name));
      return nameMatch || undefined;
    };
    const enriched = parsed.items.map(item => {
      const orig = item.status === 'agregado' ? originalByRef.get(norm(item.ref)) : findOriginal(item.ref, item.name);
      return {
        ref: orig?.product_ref ?? item.ref,
        name: item.name || orig?.product_name || item.ref,
        ordered_quantity: orig?.quantity ?? 0,
        packed_quantity: Math.max(0, item.packed_quantity),
        price: orig?.price_at_time ?? 0,
        unit_type: item.unit_type || orig?.unit_type || 'unidad',
        status: item.status,
        note: item.note || null
      };
    });

    // Para cualquier item sin precio (agregados o cruces fallidos), intentar buscar en inventario
    const missingPrice = enriched.filter(i => !i.price);
    if (missingPrice.length > 0) {
      // Buscar tanto por la REF completa como por su primer token
      const refsToSearch = [...new Set(missingPrice.flatMap(i => [i.ref, i.ref.split(/\s+/)[0]]))];
      const { data: inv } = await getSupabase()
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto, "P. Venta"')
        .in('Referencia', refsToSearch);
      if (inv) {
        const invByRef = new Map(inv.map((r: any) => [norm(r.Referencia), r]));
        const invByToken = new Map<string, any>();
        for (const r of inv) {
          const tok = norm((r as any).Referencia).split(' ')[0];
          invByToken.set(tok, invByToken.has(tok) ? null : r);
        }
        for (const item of enriched) {
          if (item.price) continue;
          const row = invByRef.get(norm(item.ref)) || invByToken.get(norm(item.ref).split(' ')[0]);
          if (row) {
            item.price = row['P. Venta'] ? parseFloat(row['P. Venta']) : 0;
            if (!item.name || item.name === item.ref) item.name = row.Producto;
          }
        }
      }
    }

    return NextResponse.json({ success: true, items: enriched, packing: parsed.packing });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/orders/[id]/remission/analyze error:', msg);
    return NextResponse.json(
      { success: false, message: 'Error analizando las imágenes', _debug: msg },
      { status: 500 }
    );
  }
}
