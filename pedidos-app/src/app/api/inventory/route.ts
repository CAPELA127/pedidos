import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  // Listado completo para el caché offline del cliente
  if (searchParams.get('all') === '1') {
    try {
      const supabase = getSupabase();
      const pageSize = 1000;
      interface InventoryRow { Referencia: string; Producto: string; 'P. Venta': string | null }
      const rows: InventoryRow[] = [];

      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase
          .from('INVENTARIO EL PUNTAZO')
          .select('Referencia, Producto, "P. Venta"')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        rows.push(...((data || []) as InventoryRow[]));
        if (!data || data.length < pageSize) break;
      }

      const products = rows
        .filter((row) => row.Referencia)
        .map((row) => ({
          ref: row.Referencia,
          name: row.Producto,
          price: row['P. Venta'] ? parseFloat(row['P. Venta']) : null,
        }));

      return NextResponse.json({ products });
    } catch (error) {
      console.error('GET /api/inventory?all=1 error:', error);
      return NextResponse.json({ products: [] });
    }
  }

  if (!q || q.length < 1) {
    return NextResponse.json({ products: [] });
  }

  try {
    const supabase = getSupabase();

    // Búsqueda por referencia exacta primero
    const { data: exact } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .ilike('Referencia', `${q}%`)
      .limit(6);

    // Búsqueda por nombre o referencia con contiene
    const { data: fuzzy } = await supabase
      .from('INVENTARIO EL PUNTAZO')
      .select('Referencia, Producto, "P. Venta"')
      .or(`Referencia.ilike.%${q}%,Producto.ilike.%${q}%`)
      .limit(10);

    // Combinar y deduplicar por Referencia
    const seen = new Set<string>();
    const all = [...(exact || []), ...(fuzzy || [])].filter((row: any) => {
      if (seen.has(row.Referencia)) return false;
      seen.add(row.Referencia);
      return true;
    });

    const products = all.slice(0, 8).map((row: any) => ({
      ref: row.Referencia,
      name: row.Producto,
      price: row['P. Venta'] ? parseFloat(row['P. Venta']) : null,
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/inventory error:', error);
    return NextResponse.json({ products: [] });
  }
}
