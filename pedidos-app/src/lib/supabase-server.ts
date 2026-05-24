import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
    throw new Error('Supabase URL no configurada');
  }

  if (!key) {
    console.error('Missing env: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    throw new Error('Supabase key no configurada');
  }

  return createClient(url, key);
}
