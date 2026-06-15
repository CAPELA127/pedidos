import XLSX from 'xlsx';
import { env } from './_env.mjs';

const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'C:/Users/JuanPelaez/Downloads/INVENTARIO JUNIO PTZ.xlsx';
const TABLE = 'INVENTARIO EL PUNTAZO';
const DRY = process.argv.includes('--dry');

// Columnas que existen en la tabla en vivo (12)
const COLS = [
  'id_producto', 'Producto', 'Referencia', 'codigo_barras', 'Existencias',
  'Unidad de Medida', 'Categoria', 'Marca', 'P. Venta', 'Total_venta',
  'ubicacion', 'total_paquete',
];

const base = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/' + encodeURIComponent(TABLE);
const headers = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};

function clean(v) {
  if (v === '' || v === undefined) return null;
  return v;
}

// --- Leer Excel ---
const wb = XLSX.readFile(FILE);
const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

const rows = raw.map((r) => {
  const o = {};
  for (const c of COLS) o[c] = clean(r[c]);
  return o;
});

// --- Validaciones ---
const ids = rows.map((r) => r.id_producto);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
const noId = rows.filter((r) => r.id_producto === null || r.id_producto === undefined);

console.log('Total filas en Excel:', rows.length);
console.log('id_producto duplicados:', [...new Set(dupIds)].slice(0, 20), dupIds.length ? `(${dupIds.length})` : '');
console.log('Filas sin id_producto:', noId.length);
console.log('Ejemplo fila:', JSON.stringify(rows[0]));

if (DRY) {
  console.log('\n--- DRY RUN, no se escribió nada ---');
  process.exit(0);
}

if (dupIds.length || noId.length) {
  console.error('\nAbortado: hay id_producto duplicados o vacíos. Revisa el Excel.');
  process.exit(1);
}

// --- 1. Borrar todo ---
console.log('\nBorrando filas existentes...');
const del = await fetch(base + '?id_producto=not.is.null', { method: 'DELETE', headers });
if (!del.ok) {
  console.error('Error al borrar:', del.status, await del.text());
  process.exit(1);
}
console.log('Borrado OK.');

// --- 2. Insertar en lotes ---
const BATCH = 500;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const res = await fetch(base, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error(`Error en lote ${i}-${i + chunk.length}:`, res.status, await res.text());
    process.exit(1);
  }
  inserted += chunk.length;
  console.log(`Insertadas ${inserted}/${rows.length}`);
}

// --- 3. Verificar ---
const chk = await fetch(base + '?select=id_producto&limit=1', { headers: { ...headers, Prefer: 'count=exact' } });
console.log('Conteo final:', chk.headers.get('content-range'));
console.log('Listo.');
