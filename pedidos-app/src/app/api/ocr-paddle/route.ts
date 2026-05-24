import { getSupabase } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // Optimizado: OCR rápido con compresión agresiva

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

// Crop optimizado para VELOCIDAD (zona centro-inferior para referencias)
async function cropToReferenceZone(imagePath: string): Promise<Buffer> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return (await image.toBuffer()) as Buffer;
  }

  const width = metadata.width;
  const height = metadata.height;

  // Crop más pequeño: solo centro inferior (donde está la referencia + precio)
  // Esto reduce área a procesar en ~70%
  const cropWidth = Math.floor(width * 0.85);
  const cropHeight = Math.floor(height * 0.35);
  const left = Math.floor((width - cropWidth) / 2);
  const top = Math.floor(height * 0.35); // Abajo a mitad

  try {
    return await image
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toBuffer() as Buffer;
  } catch {
    return (await image.toBuffer()) as Buffer;
  }
}

// Compresión agresiva para OCR RÁPIDO (sacrificar calidad por velocidad)
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    // Comprimir agresivamente: 1024x768 es suficiente para OCR
    // Esto hace OCR 3-4x más rápido
    return await sharp(buffer)
      .resize(1024, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 }) // Calidad media suficiente
      .toBuffer() as Buffer;
  } catch (e) {
    console.error('Compression error:', e);
    // Si falla, intentar con tamaño aún más pequeño
    try {
      return await sharp(buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer() as Buffer;
    } catch {
      return buffer;
    }
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
      // Si no encontró referencia clara, aceptar cualquier número como referencia
      const anyNumber = text.match(/\d{3,}/);
      if (anyNumber) {
        const ref = anyNumber[0].substring(0, 10); // Tomar primeros 10 dígitos
        return NextResponse.json({
          success: true,
          data: {
            ref: ref,
            name: 'Producto Desconocido',
            price: price || null,
            rawText: text
          },
          confidence: 40, // Confianza baja pero válida
          processingTime: Date.now() - startTime,
          warning: 'Referencia detectada con baja confianza',
        });
      }

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
    const errorMsg = error instanceof Error ? error.message : 'Error procesando imagen';
    console.error('OCR error:', errorMsg, error);

    // SIEMPRE retornar JSON válido
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        processingTime,
      },
      { status: 200 } // Retornar 200 para evitar parsing error en cliente
    );
  }
}
