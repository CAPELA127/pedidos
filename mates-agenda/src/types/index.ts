// ─── Core entities ────────────────────────────────────────────────────────────

export type ProfeId =
  | 'alejandro'
  | 'santiago'
  | 'cristian'
  | 'dayana'
  | 'david'
  | 'maria'
  | 'julio';

export interface Profe {
  id: ProfeId;
  nombre: string;
  comuna: number;          // comuna principal
  comunasApoyo: number[];  // comunas donde puede apoyar
  color: string;
}

export type IETipo = 'Fijo' | 'Rotativo';

export interface IE {
  id: string;            // slug e.g. "alfonso-upegui-orozco"
  numero: number;        // 1-40
  nombre: string;
  tipo: IETipo;
  comuna: number;        // 1-10
}

// ─── Slots ────────────────────────────────────────────────────────────────────

export type SlotStatus = 'available' | 'assigned' | 'blocked' | 'unavailable';

export interface Slot {
  id: string;            // `${profeId}-${date}-${hour}`
  profeId: ProfeId;
  date: string;          // YYYY-MM-DD
  hour: number;          // 6-17 (6am to 5pm, each slot = 1 hour)
  status: SlotStatus;
  ieId?: string;         // set when status === 'assigned' | 'blocked'
  nota?: string;
  grupo?: string;        // e.g. "G1" for blocked slots that specify group
}

// ─── Auto-assign ──────────────────────────────────────────────────────────────

export interface AutoAssignChange {
  slotId: string;
  profeId: ProfeId;
  ieId: string;
  date: string;
  hour: number;
}

// ─── Conflicts ────────────────────────────────────────────────────────────────

export type ConflictoTipo = 'doble_profe' | 'doble_ie' | 'ie_sin_cubrir';

export interface Conflicto {
  id: string;
  tipo: ConflictoTipo;
  descripcion: string;
  profeId?: ProfeId;
  ieId?: string;
  date?: string;
  hour?: number;
  slots?: string[];
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type ViewName =
  | 'dashboard'
  | 'por-profe'
  | 'por-ie'
  | 'comunas'
  | 'conflictos'
  | 'exportar';

// ─── Week ─────────────────────────────────────────────────────────────────────

export interface Week {
  label: string;   // e.g. "Semana 3"
  dates: string[]; // YYYY-MM-DD strings for each day in the week
}
