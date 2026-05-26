import { getSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'customers';

const ALL_FIELDS = 'id, name, email, cc_nit, tipo_identificacion, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, alias, phone, telefono_2, local_name, city, departamento, pais, neighborhood, address';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');
    const email = request.nextUrl.searchParams.get('email');

    if (q) {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select(ALL_FIELDS)
        .or(`name.ilike.%${q}%,cc_nit.ilike.%${q}%,alias.ilike.%${q}%,primer_apellido.ilike.%${q}%`)
        .limit(8);

      if (error) throw error;

      return NextResponse.json({ success: true, customers: data || [] });
    }

    if (email) {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select(ALL_FIELDS)
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return NextResponse.json({ success: true, customer: data || null, exists: !!data });
    }

    return NextResponse.json({ success: false, message: 'Parámetro de búsqueda requerido' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error al buscar cliente' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      email,
      cc_nit,
      tipo_identificacion,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      alias,
      phone,
      telefono_2,
      local_name,
      city,
      departamento,
      pais,
      neighborhood,
      address,
      address_normalized
    } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Nombre requerido' },
        { status: 400 }
      );
    }

    // Buscar por cc_nit primero (identificador principal)
    if (cc_nit) {
      const { data: existing } = await getSupabase()
        .from(TABLE)
        .select(ALL_FIELDS)
        .eq('cc_nit', cc_nit)
        .single();

      if (existing) {
        return NextResponse.json({ success: true, customer: { ...existing, isNew: false } });
      }
    }

    // Fallback: buscar por local_name + address_normalized
    if (local_name && address_normalized) {
      const { data: existing } = await getSupabase()
        .from(TABLE)
        .select(ALL_FIELDS)
        .eq('local_name', local_name)
        .eq('address_normalized', address_normalized)
        .single();

      if (existing) {
        return NextResponse.json({ success: true, customer: { ...existing, isNew: false } });
      }
    }

    const { data: newCustomer, error } = await getSupabase()
      .from(TABLE)
      .insert([{
        name,
        email: email || null,
        cc_nit: cc_nit || null,
        tipo_identificacion: tipo_identificacion || null,
        primer_nombre: primer_nombre || null,
        segundo_nombre: segundo_nombre || null,
        primer_apellido: primer_apellido || null,
        segundo_apellido: segundo_apellido || null,
        alias: alias || null,
        phone: phone || null,
        telefono_2: telefono_2 || null,
        local_name: local_name || null,
        city: city || null,
        departamento: departamento || null,
        pais: pais || 'Colombia',
        neighborhood: neighborhood || null,
        address: address || null,
        address_normalized: address_normalized || null,
      }])
      .select(ALL_FIELDS)
      .single();

    if (error) {
      console.error('Supabase insert error:', JSON.stringify(error));
      throw new Error(error.message || 'No se pudo crear el cliente');
    }

    return NextResponse.json({ success: true, customer: { ...newCustomer, isNew: true } });
  } catch (error) {
    console.error('POST /api/customers error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error al guardar cliente' },
      { status: 500 }
    );
  }
}
