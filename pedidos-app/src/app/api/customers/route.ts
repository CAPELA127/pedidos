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
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: 'Nombre y email requeridos' },
        { status: 400 }
      );
    }

    // Buscar cliente existente por email
    const { data: existing } = await getSupabase()
      .from(TABLE)
      .select('id, name, email')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        customer: { id: existing.id, name: existing.name, email: existing.email, isNew: false }
      });
    }

    // Crear nuevo cliente — solo name y email, phone es opcional
    const { data: newCustomer, error } = await getSupabase()
      .from(TABLE)
      .insert([{ name, email }])
      .select('id, name, email')
      .single();

    if (error) {
      // Log completo para depuración
      console.error('Supabase insert error:', JSON.stringify(error));
      throw new Error(error.message || 'No se pudo crear el cliente en Supabase');
    }

    return NextResponse.json({
      success: true,
      customer: { id: newCustomer.id, name: newCustomer.name, email: newCustomer.email, isNew: true }
    });
  } catch (error) {
    console.error('POST /api/customers error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error al guardar cliente' },
      { status: 500 }
    );
  }
}
