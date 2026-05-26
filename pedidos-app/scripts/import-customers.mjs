/**
 * Importa clientes desde un archivo Excel a Supabase.
 * Uso: node scripts/import-customers.mjs "ruta/al/archivo.xlsx"
 *
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env.local manualmente
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
    console.log('✅ .env.local cargado');
  } catch {
    console.error('❌ No se encontró .env.local — asegúrate de correr desde la raíz del proyecto');
    process.exit(1);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const filePath = process.argv[2] || resolve(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'BASE DE DATOS CLIENTES2.xlsx');

console.log(`📂 Leyendo archivo: ${filePath}`);

let workbook;
try {
  workbook = XLSX.readFile(filePath);
} catch (e) {
  console.error(`❌ No se pudo abrir el archivo: ${filePath}`);
  console.error(e.message);
  process.exit(1);
}

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

console.log(`📊 ${rows.length} filas encontradas en hoja "${sheetName}"`);

// Normalizar texto: remover espacios extras y capitalizar
function clean(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

// Construir nombre completo desde partes
function buildName(row) {
  const nombre = clean(row['Nombre']);
  if (nombre) return nombre;
  const parts = [
    clean(row['Primer Nombre']),
    clean(row['Segundo Nombre']),
    clean(row['Primer Apellido']),
    clean(row['Segundo Apellido']),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

const customers = rows
  .map((row, i) => {
    const cc_nit = clean(row['Identificacion']);
    const name = buildName(row);

    if (!cc_nit && !name) {
      console.warn(`⚠️  Fila ${i + 2}: sin identificación ni nombre — omitida`);
      return null;
    }

    return {
      tipo_identificacion: clean(row['Tipo Identificacion']),
      cc_nit,
      name,
      alias: clean(row['Alias']),
      primer_nombre: clean(row['Primer Nombre']),
      segundo_nombre: clean(row['Segundo Nombre']),
      primer_apellido: clean(row['Primer Apellido']),
      segundo_apellido: clean(row['Segundo Apellido']),
      address: clean(row['Direccion']),
      pais: clean(row['Pais']) || 'Colombia',
      departamento: clean(row['Departamento']),
      city: clean(row['Ciudad']),
      phone: row['Telefono 1'] != null ? String(row['Telefono 1']).trim() || null : null,
      telefono_2: row['Telefono 2'] != null ? String(row['Telefono 2']).trim() || null : null,
      email: clean(row['Email']),
    };
  })
  .filter(Boolean);

console.log(`✅ ${customers.length} clientes válidos para importar`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH = 50;
let imported = 0;
let updated = 0;
let errors = 0;

for (let i = 0; i < customers.length; i += BATCH) {
  const batch = customers.slice(i, i + BATCH);

  // Separar clientes con cc_nit (upsert) de los que no tienen (insert)
  const withNit = batch.filter(c => c.cc_nit);
  const withoutNit = batch.filter(c => !c.cc_nit);

  if (withNit.length > 0) {
    const { data, error } = await supabase
      .from('customers')
      .upsert(withNit, { onConflict: 'cc_nit', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`❌ Error en lote ${i}-${i + BATCH} (con NIT):`, error.message);
      errors += withNit.length;
    } else {
      imported += data?.length || withNit.length;
    }
  }

  if (withoutNit.length > 0) {
    const { data, error } = await supabase
      .from('customers')
      .insert(withoutNit)
      .select('id');

    if (error) {
      console.error(`❌ Error en lote ${i}-${i + BATCH} (sin NIT):`, error.message);
      errors += withoutNit.length;
    } else {
      imported += data?.length || withoutNit.length;
    }
  }

  const done = Math.min(i + BATCH, customers.length);
  process.stdout.write(`\r⏳ Progreso: ${done}/${customers.length}`);
}

console.log(`\n\n🎉 Importación completa:`);
console.log(`   ✅ Insertados/actualizados: ${imported}`);
if (errors > 0) console.log(`   ❌ Errores: ${errors}`);
