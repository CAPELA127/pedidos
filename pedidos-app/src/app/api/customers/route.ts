import { getSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'customers';

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('id, name, email')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      success: true,
      customer: data || null,
      exists: !!data
    });
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
      phone,
      local_name,
      city,
      neighborhood,
      address,
      address_normalized
    } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: 'Nombre y email requeridos' },
        { status: 400 }
      );
    }

    // Buscar cliente existente por local_name + address_normalized (si están disponibles)
    if (local_name && address_normalized) {
      const { data: existing } = await getSupabase()
        .from(TABLE)
        .select('id, name, email, phone, local_name, city, neighborhood, address')
        .eq('local_name', local_name)
        .eq('address_normalized', address_normalized)
        .single();

      if (existing) {
        return NextResponse.json({
          success: true,
          customer: { ...existing, isNew: false }
        });
      }
    }

    // Crear nuevo cliente con todos los datos
    const newCustomerData = {
      name,
      email,
      phone: phone || null,
      local_name: local_name || null,
      city: city || null,
      neighborhood: neighborhood || null,
      address: address || null,
      address_normalized: address_normalized || null
    };

    const { data: newCustomer, error } = await getSupabase()
      .from(TABLE)
      .insert([newCustomerData])
      .select('id, name, email, phone, local_name, city, neighborhood, address')
      .single();

    if (error) {
      console.error('Supabase insert error:', JSON.stringify(error));
      throw new Error(error.message || 'No se pudo crear el cliente en Supabase');
    }

    return NextResponse.json({
      success: true,
      customer: { ...newCustomer, isNew: true }
    });
  } catch (error) {
    console.error('POST /api/customers error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error al guardar cliente' },
      { status: 500 }
    );
  }
}
