import type { Slot, IE, AutoAssignChange } from '../types';
import { PROFES } from '../data/initial-data';

export function computeAutoAssign(
  slots: Slot[],
  ies: IE[],
  activeDates: string[]
): AutoAssignChange[] {
  const changes: AutoAssignChange[] = [];

  // Build slot lookup
  const slotMap = new Map<string, Slot>();
  for (const slot of slots) {
    slotMap.set(slot.id, slot);
  }

  // Find already-covered IEs (any slot assigned or blocked)
  const coveredIEs = new Set(
    slots
      .filter(s => (s.status === 'assigned' || s.status === 'blocked') && s.ieId)
      .map(s => s.ieId!)
  );

  // IEs needing coverage, Fijo first
  const uncoveredIEs = ies
    .filter(ie => !coveredIEs.has(ie.id))
    .sort((a, b) => {
      if (a.tipo === 'Fijo' && b.tipo !== 'Fijo') return -1;
      if (a.tipo !== 'Fijo' && b.tipo === 'Fijo') return 1;
      return a.numero - b.numero;
    });

  if (uncoveredIEs.length === 0) return changes;

  // Track assignments we're adding (to avoid conflicts within this run)
  // profeId+date+hour → true
  const reservedProfe = new Set<string>();
  // ieId+date+hour → true (shouldn't double-book IE)
  const reservedIE = new Set<string>();

  // Initialize reserved from existing slots
  for (const slot of slots) {
    if (slot.status === 'assigned' || slot.status === 'blocked') {
      reservedProfe.add(`${slot.profeId}-${slot.date}-${slot.hour}`);
      if (slot.ieId) {
        reservedIE.add(`${slot.ieId}-${slot.date}-${slot.hour}`);
      }
    }
  }

  // Count current assignments per profe
  const assignCount = new Map<string, number>();
  for (const profe of PROFES) {
    assignCount.set(profe.id, slots.filter(
      s => s.profeId === profe.id && (s.status === 'assigned' || s.status === 'blocked')
    ).length);
  }

  // Build available slots per profe
  const availableByProfe = new Map<string, Slot[]>();
  for (const profe of PROFES) {
    availableByProfe.set(
      profe.id,
      slots.filter(s => s.profeId === profe.id && s.status === 'available')
        .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour)
    );
  }

  for (const ie of uncoveredIEs) {
    // Try to find a teacher from the same comuna first, then any
    const orderedProfes = [
      ...PROFES.filter(p => p.comuna === ie.comuna),
      ...PROFES.filter(p => p.comuna !== ie.comuna),
    ];

    // Sort by least assigned (load balancing)
    orderedProfes.sort((a, b) => {
      const sameComuna = (a.comuna === ie.comuna ? 0 : 1) - (b.comuna === ie.comuna ? 0 : 1);
      if (sameComuna !== 0) return sameComuna;
      return (assignCount.get(a.id) ?? 0) - (assignCount.get(b.id) ?? 0);
    });

    let assigned = false;
    for (const profe of orderedProfes) {
      const available = availableByProfe.get(profe.id) ?? [];

      for (const slot of available) {
        const profeKey = `${slot.profeId}-${slot.date}-${slot.hour}`;
        const ieKey = `${ie.id}-${slot.date}-${slot.hour}`;

        if (reservedProfe.has(profeKey)) continue;
        if (reservedIE.has(ieKey)) continue;

        // Make the assignment
        changes.push({
          slotId: slot.id,
          profeId: profe.id,
          ieId: ie.id,
          date: slot.date,
          hour: slot.hour,
        });

        reservedProfe.add(profeKey);
        reservedIE.add(ieKey);
        assignCount.set(profe.id, (assignCount.get(profe.id) ?? 0) + 1);

        // Remove this slot from the available pool
        const pool = availableByProfe.get(profe.id) ?? [];
        const idx = pool.findIndex(s => s.id === slot.id);
        if (idx !== -1) pool.splice(idx, 1);

        assigned = true;
        break;
      }

      if (assigned) break;
    }
  }

  // Load balancing: if any teacher has >30% more assignments than avg, try to rebalance Rotativo
  const totalAssignments = Array.from(assignCount.values()).reduce((a, b) => a + b, 0);
  const avg = totalAssignments / PROFES.length;
  const threshold = avg * 1.3;

  // Find over-assigned profes
  for (const [profeId, count] of assignCount.entries()) {
    if (count <= threshold) continue;
    // Find Rotativo changes assigned to this profe and try to reassign
    const profeChanges = changes.filter(c => c.profeId === profeId);
    for (const change of profeChanges) {
      const ie = ies.find(i => i.id === change.ieId);
      if (!ie || ie.tipo !== 'Rotativo') continue;

      // Try to find another profe with fewer assignments
      const underProfes = PROFES
        .filter(p => p.id !== profeId && (assignCount.get(p.id) ?? 0) < avg)
        .sort((a, b) => (assignCount.get(a.id) ?? 0) - (assignCount.get(b.id) ?? 0));

      for (const altProfe of underProfes) {
        const profeKey = `${profeId}-${change.date}-${change.hour}`;
        const newProfeKey = `${altProfe.id}-${change.date}-${change.hour}`;

        // Check alt profe has this slot available
        const altSlotId = `${altProfe.id}-${change.date}-${change.hour}`;
        const altSlot = slotMap.get(altSlotId);
        if (!altSlot || altSlot.status !== 'available') continue;
        if (reservedProfe.has(newProfeKey)) continue;

        // Reassign
        change.profeId = altProfe.id;
        change.slotId = altSlotId;

        reservedProfe.delete(profeKey);
        reservedProfe.add(newProfeKey);
        assignCount.set(profeId, (assignCount.get(profeId) ?? 0) - 1);
        assignCount.set(altProfe.id, (assignCount.get(altProfe.id) ?? 0) + 1);
        break;
      }
    }
  }

  return changes;
}
