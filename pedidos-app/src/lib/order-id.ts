import type { SupabaseClient } from '@supabase/supabase-js';

// Numeración consecutiva de pedidos: ORD-001 … ORD-999 y luego ORD-01000,
// ORD-01001, … El cero inicial a partir de 1000 evita chocar con los ids
// históricos: aleatorios de 4 dígitos (ORD-1000…ORD-9999, sin cero inicial)
// y por timestamp de 8 dígitos (ej: ORD-71860094).
const SEQUENTIAL_ID = /^ORD-(\d{3}|0\d{4,5})$/;

export function formatOrderId(n: number): string {
  return n <= 999 ? `ORD-${String(n).padStart(3, '0')}` : `ORD-0${n}`;
}

export function parseSequentialOrderId(id: string): number | null {
  const m = SEQUENTIAL_ID.exec(id);
  return m ? parseInt(m[1], 10) : null;
}

// Siguiente número consecutivo según lo que ya existe en la base de datos.
// Si dos vendedores confirman a la vez pueden recibir el mismo número; el
// POST de pedidos resuelve la colisión reintentando con el siguiente.
export async function nextSequentialOrderId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .like('id', 'ORD-%');
  if (error) throw error;

  let max = 0;
  for (const row of (data || []) as { id: string }[]) {
    const n = parseSequentialOrderId(row.id);
    if (n !== null && n > max) max = n;
  }
  return formatOrderId(max + 1);
}
