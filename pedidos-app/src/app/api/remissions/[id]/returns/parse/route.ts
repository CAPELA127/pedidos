import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Imágenes (fotos de listas de devolución, a veces manuscritas) → el modelo más
// capaz en visión. Texto pegado → un modelo rápido basta.
const IMAGE_MODEL = 'claude-opus-4-8';
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const RETURNS_SCHEMA = {
  type: 'object',
  properties: {
    returns: {
      type: 'array',
      description: 'Una fila por cada devolución, daño o garantía detectada.',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Referencia del producto tal como aparece en la lista de referencia facturada. Copia la REF más parecida.' },
          name: { type: 'string', description: 'Nombre del producto si se puede leer; cadena vacía si no.' },
          quantity: { type: 'integer', description: 'Cantidad devuelta / dañada / en garantía. Mínimo 1.' },
          price: { type: 'number', description: 'Precio unitario si aparece explícito en la fuente. 0 si no se indica (se usará el precio facturado).' },
          reason: { type: 'string', description: 'Motivo: quebrado, dañado, garantía, no llegó, etc. Si no se indica, usa "devolución".' },
        },
        required: ['ref', 'name', 'quantity', 'price', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['returns'],
  additionalProperties: false,
} as const;

interface InvoicedItem {
  product_ref: string;
  product_name: string | null;
  price_at_time: number | null;
}

interface ParsedReturn {
  ref: string;
  name: string;
  quantity: number;
  price: number;
  reason: string;
}

const norm = (s: string) => String(s || '').toUpperCase().trim().replace(/\s+/g, ' ');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remissionId } = await params;

    // La imagen viaja como multipart; el texto puede venir como multipart o JSON.
    let image: File | null = null;
    let text = '';
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      image = (formData.get('image') as File) || null;
      text = String(formData.get('text') || '');
    } else {
      const body = await request.json().catch(() => ({}));
      text = String(body.text || '');
    }

    if (!image && !text.trim()) {
      return NextResponse.json(
        { success: false, message: 'Envía una imagen o el texto con las devoluciones.' },
        { status: 400 }
      );
    }

    // Referencias realmente facturadas en esta remisión — el descuento por
    // devolución/garantía solo puede salir de aquí.
    const { data: rem, error: remErr } = await getSupabase()
      .from('remissions')
      .select('id, remission_items (product_ref, product_name, price_at_time)')
      .eq('id', remissionId)
      .single();

    if (remErr || !rem) {
      return NextResponse.json(
        { success: false, message: 'Remisión no encontrada' },
        { status: 404 }
      );
    }

    const invoiced = (rem.remission_items || []) as InvoicedItem[];
    if (invoiced.length === 0) {
      return NextResponse.json(
        { success: false, message: 'La remisión no tiene productos facturados' },
        { status: 400 }
      );
    }

    const invoicedList = invoiced
      .map((it, i) => `${i + 1}. REF: ${it.product_ref} | ${it.product_name || ''} | Precio facturado: ${it.price_at_time ?? 0}`)
      .join('\n');

    const instructions = `Vas a extraer las DEVOLUCIONES, DAÑOS o GARANTÍAS de una remisión.

PRODUCTOS FACTURADOS EN ESTA REMISIÓN (única fuente válida de referencias — cada devolución debe corresponder a uno de estos):
${invoicedList}

REGLAS:
1. Devuelve una fila por cada producto devuelto, dañado o en garantía que aparezca en la fuente.
2. Usa exactamente la REF de la lista facturada que corresponda a cada fila (la más parecida por referencia o por nombre).
3. Si la fuente no indica el precio unitario, deja price en 0 (se usará el precio facturado).
4. Si no hay un motivo explícito, usa "devolución".
5. NO inventes devoluciones que no estén en la fuente. Si la fuente no menciona devoluciones, devuelve una lista vacía.
6. La cantidad es cuántas unidades se devuelven de esa referencia (mínimo 1).`;

    const isImage = !!image && image.size > 0;
    const userContent: Anthropic.ContentBlockParam[] = [];

    if (isImage) {
      const buf = Buffer.from(await image!.arrayBuffer());
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (image!.type || 'image/jpeg') as ImageMediaType,
          data: buf.toString('base64'),
        },
      });
      userContent.push({ type: 'text', text: `${instructions}\n\nLa imagen es la lista de devoluciones/daños. Léela (puede ser manuscrita) y extrae las filas.` });
    } else {
      userContent.push({ type: 'text', text: `${instructions}\n\nTEXTO CON LAS DEVOLUCIONES:\n${text}` });
    }

    const response = await anthropic.messages.create({
      model: isImage ? IMAGE_MODEL : TEXT_MODEL,
      max_tokens: 8000,
      ...(isImage ? { thinking: { type: 'adaptive' as const } } : {}),
      output_config: {
        format: { type: 'json_schema', schema: RETURNS_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [{ role: 'user', content: userContent }],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { success: false, message: 'El modelo no pudo procesar la información' },
        { status: 502 }
      );
    }

    const textBlock = response.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!textBlock) throw new Error('Respuesta sin contenido');

    const parsed = JSON.parse(textBlock.text) as { returns: ParsedReturn[] };

    // Cruce contra lo facturado: exacto → primer token → prefijo → nombre.
    const invByRef = new Map<string, InvoicedItem>(invoiced.map(it => [norm(it.product_ref), it]));
    const byToken = new Map<string, InvoicedItem | null>();
    for (const it of invoiced) {
      const tok = norm(it.product_ref).split(' ')[0];
      byToken.set(tok, byToken.has(tok) ? null : it);
    }
    const byName = new Map<string, InvoicedItem | null>();
    for (const it of invoiced) {
      const n = norm(it.product_name || '');
      if (n) byName.set(n, byName.has(n) ? null : it);
    }
    const findInvoiced = (ref: string, name: string): InvoicedItem | undefined => {
      const n = norm(ref);
      const exact = invByRef.get(n);
      if (exact) return exact;
      const tok = byToken.get(n.split(' ')[0]);
      if (tok) return tok;
      const prefix = invoiced.filter(it => {
        const on = norm(it.product_ref);
        return n.length >= 3 && (on.startsWith(n) || n.startsWith(on));
      });
      if (prefix.length === 1) return prefix[0];
      return byName.get(norm(name)) || undefined;
    };

    const matched: ParsedReturn[] = [];
    const unmatched: string[] = [];
    for (const r of parsed.returns || []) {
      const qty = Math.max(1, Math.trunc(Number(r.quantity) || 0));
      const inv = findInvoiced(r.ref, r.name);
      if (!inv) {
        unmatched.push(`${r.ref || r.name || 'sin referencia'} ×${qty}`);
        continue;
      }
      const price = Number(r.price) > 0 ? Number(r.price) : (inv.price_at_time ?? 0);
      matched.push({
        ref: inv.product_ref,
        name: inv.product_name || r.name || inv.product_ref,
        quantity: qty,
        price,
        reason: r.reason?.trim() || 'devolución',
      });
    }

    return NextResponse.json({ success: true, returns: matched, unmatched });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/remissions/[id]/returns/parse error:', msg);
    return NextResponse.json(
      { success: false, message: 'Error interpretando las devoluciones', _debug: msg },
      { status: 500 }
    );
  }
}
