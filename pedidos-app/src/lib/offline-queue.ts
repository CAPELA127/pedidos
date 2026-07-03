// Cola de pedidos pendientes para modo offline.
// Los pedidos confirmados sin conexión se guardan en localStorage y se
// suben a la nube cuando el dispositivo recupera internet.

const QUEUE_KEY = 'pedidos_pending_orders_v1';
const INVENTORY_KEY = 'pedidos_inventory_cache_v1';

export interface PendingOrder {
  localId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface SyncResult {
  synced: { localId: string; orderId: string }[];
  failed: { localId: string; error: string }[];
  wentOffline: boolean;
}

export function getPendingOrders(): PendingOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePendingOrders(list: PendingOrder[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    // localStorage lleno — no hay más que hacer
  }
}

export function enqueueOrder(payload: Record<string, unknown>): PendingOrder {
  const pending: PendingOrder = {
    localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    payload,
  };
  savePendingOrders([...getPendingOrders(), pending]);
  return pending;
}

export function removePendingOrder(localId: string): void {
  savePendingOrders(getPendingOrders().filter(p => p.localId !== localId));
}

// Sube los pedidos pendientes en orden. Si la red vuelve a caer, se detiene
// y lo que quede en cola se reintenta en el próximo evento 'online'.
export async function syncPendingOrders(): Promise<SyncResult> {
  const result: SyncResult = { synced: [], failed: [], wentOffline: false };

  for (const pending of getPendingOrders()) {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.payload),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        removePendingOrder(pending.localId);
        result.synced.push({
          localId: pending.localId,
          orderId: data.order?.id || String(pending.payload.id || ''),
        });
      } else {
        // Error del servidor: conservar el pedido y seguir con el siguiente
        result.failed.push({
          localId: pending.localId,
          error: data?.message || `HTTP ${res.status}`,
        });
      }
    } catch {
      result.wentOffline = true;
      break;
    }
  }

  return result;
}

// ── Caché de inventario para buscar referencias sin conexión ────────────────

export interface CachedProduct {
  ref: string;
  name: string;
  price: number | null;
}

export function cacheInventory(products: CachedProduct[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify({ savedAt: new Date().toISOString(), products }));
  } catch {
    // inventario muy grande para localStorage — la búsqueda offline no estará disponible
  }
}

export function findCachedProduct(ref: string): CachedProduct | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return null;
    const { products } = JSON.parse(raw) as { products: CachedProduct[] };
    return products.find(p => p.ref?.toUpperCase() === ref.toUpperCase()) || null;
  } catch {
    return null;
  }
}
