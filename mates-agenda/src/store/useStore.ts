import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      localStorage.setItem(name, value);
      _persistTimer = null;
    }, 300);
  },
  removeItem: (name) => localStorage.removeItem(name),
};
import type { Slot, IE, Profe, Conflicto, ViewName, AutoAssignChange } from '../types';
import { PROFES, IES, WEEKS, generateInitialSlots, ALL_DATES } from '../data/initial-data';
import { detectConflicts } from '../lib/conflicts';
import { computeAutoAssign } from '../lib/autoAssign';

interface StoreState {
  // Data
  profes: Profe[];
  ies: IE[];
  slots: Slot[];
  conflictos: Conflicto[];

  // UI state
  selectedWeekIndex: number;
  selectedProfeId: string | null;
  selectedIEId: string | null;
  currentView: ViewName;
  pendingAutoAssign: AutoAssignChange[] | null;

  // Actions
  setView: (view: ViewName) => void;
  setSelectedProfe: (profeId: string | null) => void;
  setSelectedIE: (ieId: string | null) => void;
  setSelectedWeek: (index: number) => void;

  assignSlot: (slotId: string, ieId: string) => void;
  unassignSlot: (slotId: string) => void;
  moveSlot: (fromSlotId: string, toDate: string, toHour: number) => void;
  updateProfeComunas: (profeId: string, comunaPrincipal: number, comunasApoyo: number[]) => void;

  previewAutoAssign: () => void;
  confirmAutoAssign: () => void;
  cancelAutoAssign: () => void;

  refreshConflicts: () => void;
  resetData: () => void;
}

function buildInitialState() {
  const slots = generateInitialSlots();
  const conflictos = detectConflicts(slots, IES);
  return { slots, conflictos };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      const { slots: initialSlots, conflictos: initialConflictos } = buildInitialState();

      return {
        profes: PROFES,
        ies: IES,
        slots: initialSlots,
        conflictos: initialConflictos,

        selectedWeekIndex: 0,
        selectedProfeId: null,
        selectedIEId: null,
        currentView: 'dashboard',
        pendingAutoAssign: null,

        setView: (view) => set({ currentView: view }),
        setSelectedProfe: (profeId) => set({ selectedProfeId: profeId }),
        setSelectedIE: (ieId) => set({ selectedIEId: ieId }),
        setSelectedWeek: (index) => set({ selectedWeekIndex: index }),

        assignSlot: (slotId, ieId) => {
          set(state => {
            const newSlots = state.slots.map(s =>
              s.id === slotId
                ? { ...s, status: 'assigned' as const, ieId }
                : s
            );
            return {
              slots: newSlots,
              conflictos: detectConflicts(newSlots, state.ies),
            };
          });
        },

        unassignSlot: (slotId) => {
          set(state => {
            const newSlots = state.slots.map(s =>
              s.id === slotId && s.status === 'assigned'
                ? { ...s, status: 'available' as const, ieId: undefined }
                : s
            );
            return {
              slots: newSlots,
              conflictos: detectConflicts(newSlots, state.ies),
            };
          });
        },

        moveSlot: (fromSlotId, toDate, toHour) => {
          set(state => {
            const fromSlot = state.slots.find(s => s.id === fromSlotId);
            // Only move assigned slots (not blocked)
            if (!fromSlot || fromSlot.status !== 'assigned') return state;

            const toSlotId = `${fromSlot.profeId}-${toDate}-${toHour}`;
            const toSlot = state.slots.find(s => s.id === toSlotId);
            // Target must exist and be available
            if (!toSlot || toSlot.status !== 'available') return state;

            const newSlots = state.slots.map(s => {
              if (s.id === fromSlotId) return { ...s, status: 'available' as const, ieId: undefined };
              if (s.id === toSlotId) return { ...s, status: 'assigned' as const, ieId: fromSlot.ieId };
              return s;
            });
            return { slots: newSlots, conflictos: detectConflicts(newSlots, state.ies) };
          });
        },

        updateProfeComunas: (profeId, comunaPrincipal, comunasApoyo) => {
          set(state => ({
            profes: state.profes.map(p =>
              p.id === profeId
                ? { ...p, comuna: comunaPrincipal, comunasApoyo }
                : p
            ),
          }));
        },

        previewAutoAssign: () => {
          const { slots, ies } = get();
          const week = WEEKS[get().selectedWeekIndex];
          const changes = computeAutoAssign(slots, ies, week.dates);
          set({ pendingAutoAssign: changes });
        },

        confirmAutoAssign: () => {
          const { pendingAutoAssign, slots, ies } = get();
          if (!pendingAutoAssign) return;

          const changeMap = new Map(pendingAutoAssign.map(c => [c.slotId, c]));

          const newSlots = slots.map(s => {
            const change = changeMap.get(s.id);
            if (change) {
              return { ...s, status: 'assigned' as const, ieId: change.ieId };
            }
            return s;
          });

          set({
            slots: newSlots,
            conflictos: detectConflicts(newSlots, ies),
            pendingAutoAssign: null,
          });
        },

        cancelAutoAssign: () => {
          set({ pendingAutoAssign: null });
        },

        refreshConflicts: () => {
          const { slots, ies } = get();
          set({ conflictos: detectConflicts(slots, ies) });
        },

        resetData: () => {
          const { slots, conflictos } = buildInitialState();
          set({
            slots,
            conflictos,
            pendingAutoAssign: null,
            selectedProfeId: null,
            selectedIEId: null,
          });
        },
      };
    },
    {
      name: 'mates-agenda-store',
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (state) => ({
        slots: state.slots,
        profes: state.profes,
        selectedWeekIndex: state.selectedWeekIndex,
        currentView: state.currentView,
      }),
    }
  )
);

// ─── Derived selectors ────────────────────────────────────────────────────────

export function useCurrentWeek() {
  const selectedWeekIndex = useStore(s => s.selectedWeekIndex);
  return WEEKS[selectedWeekIndex];
}

export function useSlotsForWeek(dates: string[]) {
  return useStore(s =>
    s.slots.filter(slot => dates.includes(slot.date))
  );
}

export function useSlotsForProfe(profeId: string, dates: string[]) {
  return useStore(s =>
    s.slots.filter(slot => slot.profeId === profeId && dates.includes(slot.date))
  );
}

export function useCoveredIECount() {
  const slots = useStore(s => s.slots);
  const covered = new Set(
    slots
      .filter(s => (s.status === 'assigned' || s.status === 'blocked') && s.ieId)
      .map(s => s.ieId!)
  );
  return { covered: covered.size, total: IES.length };
}
