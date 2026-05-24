import { getSupabase } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumentado para OCR más lento en imágenes grandes

// Fallback: Si Paddle no está disponible, usa Tesseract
const USE_TESSERACT_FALLBACK = true;

// Validar imagen
function validateImage(buffer: Buffer, filename: string) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (buffer.length > maxSize) {
    throw new Error(`Imagen muy grande. Máximo 5MB, tienes ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
  }

  const validFormats = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = `image/${ext}`;

  if (!validFormats.includes(mimeType)) {
    throw new Error(`Formato no soportado. Usa JPG, PNG o WebP`);
  }

  return true;
}

// Crop automático a zona probable de referencia (arriba + centro)
// Mejorado: área más grande para mejor OCR
async function cropToReferenceZone(imagePath: string): Promise<Buffer> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return (await image.toBuffer()) as Buffer;
  }

  const width = metadata.width;
  const height = metadata.height;

  // Crop mejorado: 80% del ancho, 50% del alto, para capturar más contexto
  const cropWidth = Math.floor(width * 0.8);
  const cropHeight = Math.floor(height * 0.5);
  const left = Math.floor((width - cropWidth) / 2);
  const top = Math.floor(height * 0.05); // 5% desde arriba

  try {
    return await image
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toBuffer() as Buffer;
  } catch {
    // Si crop falla, devolver imagen completa
    return (await image.toBuffer()) as Buffer;
  }
}

// Compresión optimizada para mejor OCR (aumentar calidad)
async function compressImage(buffer: Buffer): Promise<Buffer> {
  if (buffer.length <= 2 * 1024 * 1024) {
    return buffer; // Permitir hasta 2MB sin comprimir
  }

  try {
    return await sharp(buffer)
      .resize(2400, 1800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 }) // Calidad más alta para OCR
      .toBuffer() as Buffer;
  } catch {
    return buffer;
  }
}

// Extrae referencias usando patrones regex
function extractRefs(text: string): string[] {
  const candidates: string[] = [];

  const explicitRef = text.match(/REF[:\s.#]*([A-Za-z0-9][A-Za-z0-9\-]{2,15})/gi);
  if (explicitRef) {
    explicitRef.forEach(m => {
      const val = m.replace(/^REF[:\s.#]*/i, '').trim();
      if (val) candidates.push(val);
    });
  }

  const numericRef = text.match(/\b\d{3,7}-\d{1,4}\b/g);
  if (numericRef) candidates.push(...numericRef);

  const alphaRef = text.match(/\b[A-Z]{1,4}-\d{2,6}\b/g);
  if (alphaRef) candidates.push(...alphaRef);

  const numOnly = text.match(/\b\d{5,8}\b/g);
  if (numOnly) candidates.push(...numOnly);

  return [...new Set(candidates.map(c => c.trim().toUpperCase()))];
}

// Extrae precio (COP, $, o número con puntos/comas)
function extractPrice(text: string): number | null {
  // Patrón 1: COP 25.200 o COP25200
  const copMatch = text.match(/COP[\s]*(\d{1,3}(?:[.,]\d{3})*)/i);
  if (copMatch) {
    const priceStr = copMatch[1].replace(/[.,]/g, '');
    const price = parseInt(priceStr, 10);
    if (price > 0) return price;
  }

  // Patrón 2: $ 25.200 o $25200
  const dollarMatch = text.match(/\$[\s]*(\d{1,3}(?:[.,]\d{3})*)/);
  if (dollarMatch) {
    const priceStr = dollarMatch[1].replace(/[.,]/g, '');
    const price = parseInt(priceStr, 10);
    if (price > 0) return price;
  }

  // Patrón 3: Números grandes (probablemente precios) con separador
  // Ej: 25.200 o 25,200 (más de 4 dígitos)
  const largeNum = text.match(/\b(\d{2,3}[.,]\d{3})\b/);
  if (largeNum) {
    const priceStr = largeNum[1].replace(/[.,]/g, '');
    const price = parseInt(priceStr, 10);
    if (price > 1000) return price; // Asume que es precio si > 1000
  }

  return null;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    validateImage(buffer, image.name);

    const compressedBuffer = await compressImage(buffer);

    // OCR con Tesseract optimizado (rápido + preciso)
    const worker = await createWorker(['spa', 'eng']);

    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:. $',
    });

    const { data: { text } } = await worker.recognize(compressedBuffer);
    await worker.terminate();

    console.log('OCR text:', text);

    const candidates = extractRefs(text);
    const price = extractPrice(text);

    console.log('Ref candidates:', candidates);
    console.log('Price detected:', price);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se detectó ninguna referencia',
        rawText: text,
      });
    }

    const supabase = getSupabase();

    // Buscar en inventario
    for (const ref of candidates) {
      // Exacta
      const { data: exact } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto')
        .eq('Referencia', ref)
        .limit(1);

      if (exact && exact.length > 0) {
        const processingTime = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          data: {
            ref: exact[0].Referencia,
            name: exact[0].Producto,
            price: price || null,
            rawText: text
          },
          confidence: 95,
          processingTime,
        });
      }

      // Fuzzy
      const { data: fuzzy } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Referencia, Producto')
        .ilike('Referencia', `%${ref}%`)
        .limit(1);

      if (fuzzy && fuzzy.length > 0) {
        const processingTime = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          data: {
            ref: fuzzy[0].Referencia,
            name: fuzzy[0].Producto,
            price: price || null,
            rawText: text
          },
          confidence: 75,
          processingTime,
        });
      }
    }

    // Fallback: sin inventario
    const processingTime = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      data: {
        ref: candidates[0],
        name: 'Producto Desconocido',
        price: price || null,
        rawText: text
      },
      confidence: 60,
      processingTime,
      warning: 'Referencia no encontrada en inventario',
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('OCR error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error procesando imagen',
        processingTime,
      },
      { status: 500 }
    );
  }
}
