/**
 * Normaliza dirección para comparación y UNIQUE constraint
 * Elimina espacios, convierte a minúsculas, remove acentos
 *
 * Ej: "Cra 45 #95-23, Medellín, Laureles" → "cra45#9523medellinlaureles"
 */
export function normalizeAddress(address?: string | null): string {
  if (!address) return '';

  return address
    .toLowerCase()                    // Minúsculas
    .replace(/[áéíóú]/g, c => ({     // Quitar acentos
      'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u'
    }[c] || c))
    .replace(/[^a-z0-9]/g, '')       // Remover caracteres especiales y espacios
    .trim();
}

/**
 * Valida formato de teléfono colombiano
 * Acepta: 10-15 dígitos, opcionalmente con +57, -, espacios
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;

  // Remover caracteres especiales
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Validar que tenga 10-15 dígitos
  const digitsOnly = cleaned.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Formatea teléfono a formato legible
 * "3115555555" → "311 555 5555" o "311-555-5555"
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, '');

  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('57')) {
    const local = cleaned.substring(2);
    return `+57-${local.substring(0, 3)}-${local.substring(3, 6)}-${local.substring(6)}`;
  }

  return phone;
}
