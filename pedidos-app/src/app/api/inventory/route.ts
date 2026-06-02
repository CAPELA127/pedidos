import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

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
