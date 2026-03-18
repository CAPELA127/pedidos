import type { Profe, IE, Slot, Week } from '../types';

// ─── Teachers ─────────────────────────────────────────────────────────────────

export const PROFES: Profe[] = [
  { id: 'alejandro', nombre: 'Alejandro', comuna: 1, comunasApoyo: [], color: '#3B82F6' },
  { id: 'santiago',  nombre: 'Santiago',  comuna: 2, comunasApoyo: [], color: '#10B981' },
  { id: 'cristian',  nombre: 'Cristian',  comuna: 3, comunasApoyo: [], color: '#F59E0B' },
  { id: 'dayana',    nombre: 'Dayana',    comuna: 4, comunasApoyo: [], color: '#EC4899' },
  { id: 'david',     nombre: 'David',     comuna: 5, comunasApoyo: [], color: '#8B5CF6' },
  { id: 'maria',     nombre: 'Maria',     comuna: 6, comunasApoyo: [], color: '#EF4444' },
  { id: 'julio',     nombre: 'Julio',     comuna: 7, comunasApoyo: [], color: '#06B6D4' },
];

// ─── IEs ──────────────────────────────────────────────────────────────────────

export const IES: IE[] = [
  // Comuna 1
  { id: 'alfonso-upegui-orozco',    numero: 1,  nombre: 'Alfonso Upegui Orozco',                   tipo: 'Fijo',     comuna: 1 },
  { id: 'alfredo-cook-arango',       numero: 2,  nombre: 'Alfredo Cook Arango',                      tipo: 'Rotativo', comuna: 1 },
  { id: 'angeles-custodios',         numero: 3,  nombre: 'Ángeles Custodios',                        tipo: 'Fijo',     comuna: 1 },
  { id: 'arsobispo-tulio-botero',    numero: 4,  nombre: 'Arsobispo Tulio Botero',                   tipo: 'Rotativo', comuna: 1 },
  { id: 'bello-oriente',             numero: 5,  nombre: 'Bello Oriente',                            tipo: 'Fijo',     comuna: 1 },
  { id: 'benjamin-herrera',          numero: 6,  nombre: 'Benjamin Herrera',                         tipo: 'Rotativo', comuna: 1 },
  // Comuna 2
  { id: 'blanquizal',                numero: 7,  nombre: 'Blanquizal',                               tipo: 'Fijo',     comuna: 2 },
  { id: 'ciudadela-las-americas',    numero: 8,  nombre: 'Ciudadela Las Americas',                   tipo: 'Rotativo', comuna: 2 },
  { id: 'ciudadela-nuevo-occidente', numero: 9,  nombre: 'Ciudadela Nuevo Occidente',                tipo: 'Fijo',     comuna: 2 },
  { id: 'concejo-de-medellin',       numero: 10, nombre: 'Concejo De Medellín',                      tipo: 'Rotativo', comuna: 2 },
  { id: 'cristo-rey',                numero: 11, nombre: 'Cristo Rey',                               tipo: 'Fijo',     comuna: 2 },
  { id: 'enrique-olaya-herrera',     numero: 12, nombre: 'Enrique Olaya Herrera',                    tipo: 'Rotativo', comuna: 2 },
  // Comuna 3
  { id: 'federico-ozanam',           numero: 13, nombre: 'Federico Ozanam',                          tipo: 'Fijo',     comuna: 3 },
  { id: 'gabriel-restrepo-moreno',   numero: 14, nombre: 'Gabriel Restrepo Moreno',                  tipo: 'Rotativo', comuna: 3 },
  { id: 'gabriela-gomez',            numero: 15, nombre: 'Gabriela Gomez',                           tipo: 'Fijo',     comuna: 3 },
  { id: 'gonzalo-restrepo-jaramillo',numero: 16, nombre: 'Gonzalo Restrepo Jaramillo',               tipo: 'Rotativo', comuna: 3 },
  { id: 'jose-acevedo-y-gomez',      numero: 17, nombre: 'José Acevedo Y Goméz',                    tipo: 'Fijo',     comuna: 3 },
  { id: 'jose-antonio-galan',        numero: 18, nombre: 'Jose Antonio Galan',                       tipo: 'Rotativo', comuna: 3 },
  // Comuna 4
  { id: 'jose-horacio-betancourt',   numero: 19, nombre: 'Jose Horacio Betancourt',                  tipo: 'Fijo',     comuna: 4 },
  { id: 'kennedy',                   numero: 20, nombre: 'Kennedy',                                  tipo: 'Rotativo', comuna: 4 },
  { id: 'la-esperanza',              numero: 21, nombre: 'La Esperanza',                             tipo: 'Fijo',     comuna: 4 },
  { id: 'la-loma-hermosa',           numero: 22, nombre: 'La Loma Hermosa',                          tipo: 'Rotativo', comuna: 4 },
  { id: 'la-pastora',                numero: 23, nombre: 'La Pastora',                               tipo: 'Fijo',     comuna: 4 },
  { id: 'la-presentacion',           numero: 24, nombre: 'La Presentación',                          tipo: 'Rotativo', comuna: 4 },
  // Comuna 5
  { id: 'la-salle-de-campo-amor',    numero: 25, nombre: 'La Salle De Campo Amor',                   tipo: 'Fijo',     comuna: 5 },
  { id: 'las-nieves',                numero: 26, nombre: 'Las Nieves',                               tipo: 'Rotativo', comuna: 5 },
  { id: 'lusitania',                 numero: 27, nombre: 'Lusitania',                                tipo: 'Fijo',     comuna: 5 },
  { id: 'manuel-jose-cayzedo',       numero: 28, nombre: 'Manuel José Cayzedo',                     tipo: 'Rotativo', comuna: 5 },
  { id: 'merceditas',                numero: 29, nombre: 'Merceditas',                               tipo: 'Fijo',     comuna: 5 },
  { id: 'milagrosa',                 numero: 30, nombre: 'Milagrosa',                               tipo: 'Rotativo', comuna: 5 },
  // Comuna 6
  { id: 'miraflores',                numero: 31, nombre: 'Miraflores',                               tipo: 'Fijo',     comuna: 6 },
  { id: 'montecarlo-guillermo',      numero: 32, nombre: 'Montecarlo - Guillermo Gaviria Correa',    tipo: 'Rotativo', comuna: 6 },
  { id: 'nicanor-restrepo',          numero: 33, nombre: 'Nicanor Restrepo',                         tipo: 'Fijo',     comuna: 6 },
  { id: 'octavio-calderon',          numero: 34, nombre: 'Octavio Calderon',                         tipo: 'Rotativo', comuna: 6 },
  { id: 'pedregal',                  numero: 35, nombre: 'Pedregal',                                 tipo: 'Fijo',     comuna: 6 },
  // Comuna 7
  { id: 'reino-de-belgica',          numero: 36, nombre: 'Reino De Belgica',                         tipo: 'Rotativo', comuna: 7 },
  { id: 'san-juan-bautista',         numero: 37, nombre: 'San Juan Bautista De La Salle',            tipo: 'Fijo',     comuna: 7 },
  { id: 'san-lorenzo-de-aburra',     numero: 38, nombre: 'San Lorenzo De Aburra',                    tipo: 'Rotativo', comuna: 7 },
  { id: 'santa-elena',               numero: 39, nombre: 'Santa Elena',                              tipo: 'Fijo',     comuna: 7 },
  { id: 'santo-angel',               numero: 40, nombre: 'Santo Ángel',                              tipo: 'Rotativo', comuna: 7 },
];

// ─── Weeks / Dates ────────────────────────────────────────────────────────────

export const WEEKS: Week[] = [
  {
    label: 'Semana 3',
    dates: ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21'],
  },
  {
    label: 'Semana 4',
    dates: ['2026-03-23', '2026-03-24'],
  },
  {
    label: 'Abril',
    dates: ['2026-04-06', '2026-04-07'],
  },
];

export const ALL_DATES: string[] = WEEKS.flatMap(w => w.dates);

// Hours available each day: 6am (6) to 5pm (17), each slot 1 hour
export const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// ─── Pre-assigned / blocked slots ────────────────────────────────────────────

interface BlockedDef {
  profeId: string;
  date: string;
  hours: number[];
  ieId: string;
  grupo?: string;
}

const BLOCKED_DEFS: BlockedDef[] = [
  // Alejandro  2026-03-16  8-11h   La Pastora
  { profeId: 'alejandro', date: '2026-03-16', hours: [8, 9, 10],      ieId: 'la-pastora' },
  // Alejandro  2026-03-21  11-12h  Concejo De Medellín
  { profeId: 'alejandro', date: '2026-03-21', hours: [11],             ieId: 'concejo-de-medellin' },
  // Santiago   2026-03-17  12-14h  Manuel José Cayzedo
  { profeId: 'santiago',  date: '2026-03-17', hours: [12, 13],         ieId: 'manuel-jose-cayzedo' },
  // Santiago   2026-03-19  8-11h   Federico Ozanam
  { profeId: 'santiago',  date: '2026-03-19', hours: [8, 9, 10],       ieId: 'federico-ozanam' },
  // Cristian   2026-03-19  6-8h    Alfredo Cook Arango G1
  { profeId: 'cristian',  date: '2026-03-19', hours: [6, 7],           ieId: 'alfredo-cook-arango', grupo: 'G1' },
  // Cristian   2026-03-21  10-12h  Concejo De Medellín G1
  { profeId: 'cristian',  date: '2026-03-21', hours: [10, 11],         ieId: 'concejo-de-medellin', grupo: 'G1' },
  // Cristian   2026-03-23  9-10h   San Lorenzo De Aburra
  { profeId: 'cristian',  date: '2026-03-23', hours: [9],              ieId: 'san-lorenzo-de-aburra' },
];

// ─── Availability pattern ────────────────────────────────────────────────────
// Generates a realistic "available" / "unavailable" pattern per teacher per day.
// Each teacher has a seeded but varied pattern.

interface AvailabilityWindow {
  start: number;
  end: number; // exclusive
}

function getAvailability(profeId: string, date: string): AvailabilityWindow[] {
  // Use a deterministic pseudo-random based on profe + date
  const seed = (profeId.charCodeAt(0) + date.charCodeAt(8) * 7 + date.charCodeAt(9) * 13) % 17;

  const patterns: AvailabilityWindow[][] = [
    [{ start: 6,  end: 12 }, { start: 14, end: 18 }],   // 0
    [{ start: 7,  end: 14 }],                             // 1
    [{ start: 6,  end: 10 }, { start: 12, end: 17 }],   // 2
    [{ start: 8,  end: 18 }],                             // 3
    [{ start: 6,  end: 9  }, { start: 11, end: 16 }],   // 4
    [{ start: 9,  end: 17 }],                             // 5
    [{ start: 6,  end: 13 }],                             // 6
    [{ start: 7,  end: 11 }, { start: 13, end: 18 }],   // 7
    [{ start: 6,  end: 15 }],                             // 8
    [{ start: 8,  end: 12 }, { start: 14, end: 18 }],   // 9
    [{ start: 6,  end: 18 }],                             // 10
    [{ start: 7,  end: 15 }],                             // 11
    [{ start: 6,  end: 11 }, { start: 13, end: 17 }],   // 12
    [{ start: 9,  end: 18 }],                             // 13
    [{ start: 6,  end: 8  }, { start: 10, end: 16 }],   // 14
    [{ start: 8,  end: 16 }],                             // 15
    [{ start: 6,  end: 12 }, { start: 15, end: 18 }],   // 16
  ];

  return patterns[seed];
}

function isHourAvailable(profeId: string, date: string, hour: number): boolean {
  const windows = getAvailability(profeId, date);
  return windows.some(w => hour >= w.start && hour < w.end);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateInitialSlots(): Slot[] {
  const slots: Slot[] = [];

  // Build blocked slot lookup for quick access
  const blockedMap = new Map<string, BlockedDef>();
  for (const def of BLOCKED_DEFS) {
    for (const hour of def.hours) {
      const key = `${def.profeId}-${def.date}-${hour}`;
      blockedMap.set(key, def);
    }
  }

  for (const profe of PROFES) {
    for (const date of ALL_DATES) {
      for (const hour of HOURS) {
        const id = `${profe.id}-${date}-${hour}`;
        const blockedDef = blockedMap.get(id);

        if (blockedDef) {
          slots.push({
            id,
            profeId: profe.id,
            date,
            hour,
            status: 'blocked',
            ieId: blockedDef.ieId,
            grupo: blockedDef.grupo,
          });
        } else {
          const available = isHourAvailable(profe.id, date, hour);
          slots.push({
            id,
            profeId: profe.id,
            date,
            hour,
            status: available ? 'available' : 'unavailable',
          });
        }
      }
    }
  }

  return slots;
}
