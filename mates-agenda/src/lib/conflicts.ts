import type { Slot, Conflicto, IE } from '../types';
import { PROFES } from '../data/initial-data';

let _conflictoCounter = 0;

export function detectConflicts(slots: Slot[], ies: IE[]): Conflicto[] {
  const conflicts: Conflicto[] = [];
  _conflictoCounter = 0;

  // Group active slots (assigned or blocked) by profe+date+hour
  const byProfeDateTime = new Map<string, Slot[]>();
  const byIEDateTime = new Map<string, Slot[]>();

  for (const slot of slots) {
    if (slot.status !== 'assigned' && slot.status !== 'blocked') continue;

    // profe double booking
    const profeKey = `${slot.profeId}-${slot.date}-${slot.hour}`;
    const profeGroup = byProfeDateTime.get(profeKey) ?? [];
    profeGroup.push(slot);
    byProfeDateTime.set(profeKey, profeGroup);

    // IE double booking
    if (slot.ieId) {
      const ieKey = `${slot.ieId}-${slot.date}-${slot.hour}`;
      const ieGroup = byIEDateTime.get(ieKey) ?? [];
      ieGroup.push(slot);
      byIEDateTime.set(ieKey, ieGroup);
    }
  }

  // Double-booked teachers
  for (const [key, group] of byProfeDateTime.entries()) {
    if (group.length > 1) {
      const [profeId, date, hourStr] = key.split('-');
      const profe = PROFES.find(p => p.id === profeId);
      conflicts.push({
        id: `doble_profe_${_conflictoCounter++}`,
        tipo: 'doble_profe',
        descripcion: `${profe?.nombre ?? profeId} tiene ${group.length} asignaciones el ${date} a las ${hourStr}h`,
        profeId: profeId as Slot['profeId'],
        date,
        hour: parseInt(hourStr),
        slots: group.map(s => s.id),
      });
    }
  }

  // Double-booked IEs
  for (const [key, group] of byIEDateTime.entries()) {
    if (group.length > 1) {
      const parts = key.split('-');
      const hour = parts[parts.length - 1];
      const date = parts[parts.length - 2] + '-' + parts[parts.length - 3] + '-' + parts[parts.length - 4]; // YYYY-MM-DD
      // Actually the key format is `${ieId}-${date}-${hour}` where date = YYYY-MM-DD
      // So we need to parse carefully
      const ieId = key.substring(0, key.lastIndexOf('-', key.lastIndexOf('-') - 1) - 3);
      const ie = ies.find(i => i.id === group[0].ieId);
      conflicts.push({
        id: `doble_ie_${_conflictoCounter++}`,
        tipo: 'doble_ie',
        descripcion: `${ie?.nombre ?? group[0].ieId} tiene ${group.length} profes asignados al mismo tiempo`,
        ieId: group[0].ieId,
        date: group[0].date,
        hour: group[0].hour,
        slots: group.map(s => s.id),
      });
    }
  }

  // IEs without any coverage this week
  const coveredIEs = new Set(
    slots
      .filter(s => (s.status === 'assigned' || s.status === 'blocked') && s.ieId)
      .map(s => s.ieId!)
  );

  for (const ie of ies) {
    if (!coveredIEs.has(ie.id)) {
      conflicts.push({
        id: `ie_sin_cubrir_${_conflictoCounter++}`,
        tipo: 'ie_sin_cubrir',
        descripcion: `${ie.nombre} (${ie.tipo}) no tiene cobertura asignada`,
        ieId: ie.id,
      });
    }
  }

  return conflicts;
}
