// Persistencia local del pedido en curso (borrador).
// Se guarda en localStorage para sobrevivir recargas, cierres de pestaña o caídas.

const DRAFT_KEY = 'pedidos_draft_v1';

export interface StoredDraft<T> {
  version: 1;
  savedAt: string;
  data: T;
}

export function saveDraft<T>(data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const draft: StoredDraft<T> = { version: 1, savedAt: new Date().toISOString(), data };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage lleno o bloqueado — el borrador simplemente no se guarda
  }
}

export function loadDraft<T>(): StoredDraft<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft<T>;
    if (draft?.version !== 1 || !draft.data) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignorar
  }
}
