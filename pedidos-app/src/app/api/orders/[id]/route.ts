import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItemUpdate {
  ref: string;
  name: string;
  quantity: number;
  price?: number;
  unit_type?: string;
  notes?: string;
  discount_percent?: number;
  tax_percent?: number;
  barcode?: string;
  cost?: number;
  real_cost?: number;
  returned_quantity?: number;
}

// Formula contable compartida con la plantilla de secretaría (facturaA-971.xlsx):
// Total = (precio*cant)*(1-descuento%)*(1+impuesto%).
// Con descuento/impuesto en 0 (valor por defecto), el resultado es precio*cantidad —
// así que esta fórmula es compatible hacia atrás con pedidos que nunca pasaron por secretaría.
const computeItemTotal = (item: OrderItemUpdate) => {
  const price = item.price || 0;
  const qty = item.quantity || 0;
  const discount = item.discount_percent || 0;
  const tax = item.tax_percent || 0;
  const subtotal = price * qty - (price * qty) * (discount / 100);
  return subtotal * (tax / 100 + 1);
};

interface OrderRow {
  id: string; customer_id: string; status: string; total: number;
  vendor_name: string | null; delivery_address: string | null; notes: string | null; created_at: string;
  customers: { id: string; name: string; email: string | null; phone: string | null; local_name: string | null; city: string | null; neighborhood: string | null; address: string | null }
    | { id: string; name: string; email: string | null; phone: string | null; local_name: string | null; city: string | null; neighborhood: string | null; address: string | null }[] | null;
  order_items: {
    id: string; product_ref: string; product_name: string | null; quantity: number; unit_type: string | null;
    notes: string | null; price_at_time: number; discount_percent?: number | null; tax_percent?: number | null;
    barcode?: string | null; cost?: number | null; real_cost?: number | null; returned_quantity?: number | null;
  }[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const withAccounting = `
        id, customer_id, status, total, vendor_name, delivery_address, notes, created_at,
        customers (id, name, email, phone, local_name, city, neighborhood, address),
        order_items (id, product_ref, product_name, quantity, unit_type, notes, price_at_time, discount_percent, tax_percent, barcode, cost, real_cost, returned_quantity)
      `;
    const withoutAccounting = `
        id, customer_id, status, total, vendor_name, delivery_address, notes, created_at,
        customers (id, name, email, phone, local_name, city, neighborhood, address),
        order_items (id, product_ref, product_name, quantity, unit_type, notes, price_at_time)
      `;
    let { data: order, error } = await getSupabase()
      .from('orders')
      .select(withAccounting)
      .eq('id', orderId)
      .single();

    // Migración ADD_SECRETARIA_ACCOUNTING_FIELDS.sql aún no corrida — reintentar sin esas columnas
    if (error?.code === '42703') {
      ({ data: order, error } = await getSupabase()
        .from('orders')
        .select(withoutAccounting)
        .eq('id', orderId)
        .single());
    }

    if (error || !order) {
      return NextResponse.json({ success: false, message: 'Pedido no encontrado' }, { status: 404 });
    }

    const orderRow = order as unknown as OrderRow;

    const customer = Array.isArray(orderRow.customers) ? orderRow.customers[0] : orderRow.customers;

    return NextResponse.json({
      success: true,
      order: {
        id: orderRow.id,
        customer: customer?.name || 'Sin nombre',
        email: customer?.email || '',
        phone: customer?.phone || '',
        local_name: customer?.local_name || '',
        city: customer?.city || '',
        neighborhood: customer?.neighborhood || '',
        address: customer?.address || '',
        customer_id: orderRow.customer_id,
        vendor_name: orderRow.vendor_name || '',
        delivery_address: orderRow.delivery_address || '',
        notes: orderRow.notes || '',
        status: orderRow.status,
        total: orderRow.total,
        items: (orderRow.order_items || []).map((oi) => ({
          ref: oi.product_ref,
          name: oi.product_name || oi.product_ref,
          quantity: oi.quantity,
          unit_type: oi.unit_type || 'unidad',
          notes: oi.notes || undefined,
          price: oi.price_at_time,
          discount_percent: oi.discount_percent || 0,
          tax_percent: oi.tax_percent || 0,
          barcode: oi.barcode || '',
          cost: oi.cost || 0,
          real_cost: oi.real_cost || 0,
          returned_quantity: oi.returned_quantity || 0,
        })),
      }
    });
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error obteniendo pedido' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { items, status } = body;

    // ── Actualización solo de status (sin items) ──
    if (!items && status) {
      const { error: statusErr } = await getSupabase()
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (statusErr) throw statusErr;
      return NextResponse.json({ success: true, message: 'Estado actualizado' });
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: 'Se requiere el array de items' },
        { status: 400 }
      );
    }

    const total = items.reduce((sum: number, item: OrderItemUpdate) => sum + computeItemTotal(item), 0);

    // Actualizar total y status de la orden
    const { error: updateError } = await getSupabase()
      .from('orders')
      .update({ status: status || 'Pendiente', total })
      .eq('id', orderId);
    if (updateError) throw updateError;

    // Traer items actuales
    const { data: existingItems, error: fetchError } = await getSupabase()
      .from('order_items')
      .select('id, product_ref, product_name')
      .eq('order_id', orderId);
    if (fetchError) throw fetchError;

    // Misma referencia puede tener presentaciones distintas (nombre distinto) —
    // el match debe ser por ref + nombre, no solo por ref, para no mezclar variantes.
    const itemKey = (ref: string, name: string) => `${ref}::${name}`;
    const newKeys = new Set(items.map((i: OrderItemUpdate) => itemKey(i.ref, i.name)));

    // Eliminar items removidos
    const toDelete = (existingItems || []).filter(i => !newKeys.has(itemKey(i.product_ref, i.product_name)));
    if (toDelete.length > 0) {
      const { error: delErr } = await getSupabase()
        .from('order_items')
        .delete()
        .in('id', toDelete.map(i => i.id));
      if (delErr) throw delErr;
    }

    // Actualizar o crear cada item
    for (const item of items) {
      const existing = (existingItems || []).find(i => itemKey(i.product_ref, i.product_name) === itemKey(item.ref, item.name));
      const fields = {
        quantity: item.quantity,
        price_at_time: item.price || 0,
        product_name: item.name,
        unit_type: item.unit_type || 'unidad',
        notes: item.notes || null,
        discount_percent: item.discount_percent || 0,
        tax_percent: item.tax_percent || 0,
        barcode: item.barcode || null,
        cost: item.cost || 0,
        real_cost: item.real_cost || 0,
        returned_quantity: item.returned_quantity || 0,
      };
      if (existing) {
        const { error: updErr } = await getSupabase()
          .from('order_items')
          .update(fields)
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await getSupabase()
          .from('order_items')
          .insert({ order_id: orderId, product_ref: item.ref, ...fields });
        if (insErr) throw insErr;
      }
    }

    return NextResponse.json({ success: true, message: 'Pedido actualizado', total });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    const code = (error as { code?: string })?.code;
    if (code === '42703' || code === 'PGRST204') {
      return NextResponse.json(
        { success: false, message: 'Falta correr la migración ADD_SECRETARIA_FACTURA_FIELDS.sql en Supabase antes de editar estos campos.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error actualizando pedido' },
      { status: 500 }
    );
  }
}
