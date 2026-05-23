import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
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

    // Buscar cliente existente
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        customer: { ...existing, name, email, isNew: false }
      });
    }

    // Crear nuevo cliente
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert([{ name, email }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      customer: { ...newCustomer, isNew: true }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error al guardar cliente' },
      { status: 500 }
    );
  }
}
