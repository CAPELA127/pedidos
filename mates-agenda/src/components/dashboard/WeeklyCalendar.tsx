import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import type { Slot } from '../../types';
import { useStore, useCurrentWeek } from '../../store/useStore';
import { IES, HOURS } from '../../data/initial-data';

const HOUR_LABELS: Record<number, string> = {
  6: '6am', 7: '7am', 8: '8am', 9: '9am', 10: '10am', 11: '11am',
  12: '12pm', 13: '1pm', 14: '2pm', 15: '3pm', 16: '4pm', 17: '5pm',
};

// ─── Draggable slot badge ────────────────────────────────────────────────────

function DraggableSlotBadge({
  slot,
  isOverlay = false,
}: {
  slot: Slot;
  isOverlay?: boolean;
}) {
  const profes = useStore(s => s.profes);
  const profe = profes.find(p => p.id === slot.profeId);
  const ie = IES.find(i => i.id === slot.ieId);
  const isApoyo = profe && ie && ie.comuna !== profe.comuna;
  const { unassignSlot } = useStore();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
    disabled: slot.status === 'blocked',
  });

  const style = {
    backgroundColor: profe?.color ?? '#888',
    transform: isOverlay ? undefined : CSS.Translate.toString(transform),
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    cursor: slot.status === 'blocked' ? 'not-allowed' : 'grab',
    transition: isDragging ? 'none' : 'opacity 0.15s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'group relative flex items-center gap-1 rounded-md px-1.5 py-1 text-white text-xs font-medium shadow-sm select-none',
        isOverlay && 'rotate-1 shadow-xl scale-105',
        slot.status === 'blocked' && 'opacity-80',
      )}
      title={`${profe?.nombre}${ie ? ` → ${ie.nombre}` : ''}${slot.status === 'blocked' ? ' (bloqueado)' : ''}`}
    >
      {slot.status !== 'blocked' && (
        <GripVertical size={10} className="shrink-0 opacity-70" />
      )}
      <span className="truncate flex-1">
        {profe?.nombre.substring(0, 3)}{ie ? ` · ${ie.nombre.substring(0, 8)}` : ''}
        {slot.status === 'blocked' ? ' 🔒' : ''}
      </span>
      {isApoyo && !isOverlay && (
        <span className="shrink-0 text-xs bg-white/30 text-white font-bold px-1 py-0.5 rounded leading-none">
          Apoyo
        </span>
      )}
      {slot.status === 'assigned' && !isOverlay && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); unassignSlot(slot.id); }}
          className="shrink-0 w-3.5 h-3.5 rounded-full bg-white/30 hover:bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={8} />
        </button>
      )}
    </div>
  );
}

// ─── Droppable cell ──────────────────────────────────────────────────────────

function DroppableCell({
  date,
  hour,
  slots,
  filterProfeId,
  filterIEId,
  draggingSlot,
}: {
  date: string;
  hour: number;
  slots: Slot[];
  filterProfeId: string | null;
  filterIEId: string | null;
  draggingSlot: Slot | null;
}) {
  const cellId = `cell::${date}::${hour}`;
  const { isOver, setNodeRef } = useDroppable({ id: cellId, data: { date, hour } });

  const activeSlots = slots.filter(s => {
    if (s.date !== date || s.hour !== hour) return false;
    if (s.status !== 'assigned' && s.status !== 'blocked') return false;
    if (filterProfeId && s.profeId !== filterProfeId) return false;
    if (filterIEId && s.ieId !== filterIEId) return false;
    return true;
  });

  const profes = useStore(s => s.profes);

  // Background: color of the first assigned profe (with low opacity) or drop highlight
  const firstProfe = activeSlots.length > 0
    ? profes.find(p => p.id === activeSlots[0].profeId)
    : null;

  // Check if this cell is a valid drop target for the dragging slot
  const isValidTarget = draggingSlot
    ? slots.some(
        s => s.profeId === draggingSlot.profeId && s.date === date && s.hour === hour && s.status === 'available'
      )
    : false;

  const bgColor = firstProfe
    ? `${firstProfe.color}18`  // 10% opacity background
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'min-h-12 p-1 border-b border-r border-slate-100 space-y-0.5 transition-colors duration-100',
        isOver && isValidTarget && 'ring-2 ring-inset ring-blue-400 bg-blue-50',
        isOver && !isValidTarget && draggingSlot && 'bg-red-50 ring-2 ring-inset ring-red-300',
        !isOver && isValidTarget && draggingSlot && 'bg-emerald-50',
      )}
      style={{ backgroundColor: (!isOver && !draggingSlot && bgColor) ? bgColor : undefined }}
    >
      {activeSlots.map(slot => (
        <DraggableSlotBadge key={slot.id} slot={slot} />
      ))}
    </div>
  );
}

// ─── Main calendar ────────────────────────────────────────────────────────────

export function WeeklyCalendar() {
  const currentWeek = useCurrentWeek();
  const allSlots = useStore(s => s.slots);
  const profes = useStore(s => s.profes);
  const { moveSlot } = useStore();

  const [filterProfeId, setFilterProfeId] = useState<string | null>(null);
  const [filterIEId, setFilterIEId] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const weekSlots = allSlots.filter(s => currentWeek.dates.includes(s.date));
  const draggingSlot = activeSlotId ? allSlots.find(s => s.id === activeSlotId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveSlotId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSlotId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('cell::')) return;

    const parts = overId.split('::');
    const date = parts[1];
    const hour = parseInt(parts[2], 10);
    moveSlot(String(active.id), date, hour);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterProfeId ?? ''}
          onChange={e => setFilterProfeId(e.target.value || null)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los profes</option>
          {profes.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        <select
          value={filterIEId ?? ''}
          onChange={e => setFilterIEId(e.target.value || null)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las IEs</option>
          {IES.map(ie => (
            <option key={ie.id} value={ie.id}>{ie.nombre}</option>
          ))}
        </select>

        {(filterProfeId || filterIEId) && (
          <button
            onClick={() => { setFilterProfeId(null); setFilterIEId(null); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}

        {draggingSlot && (
          <div className="flex items-center gap-2 ml-auto text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Suelta en una celda verde para mover
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 flex-wrap">
        {profes.map(p => (
          <div
            key={p.id}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all',
              filterProfeId === p.id ? 'ring-2 ring-offset-1' : 'hover:opacity-80'
            )}
            style={{ backgroundColor: p.color + '22', color: p.color }}
            onClick={() => setFilterProfeId(filterProfeId === p.id ? null : p.id)}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.nombre}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
        <div style={{ minWidth: '900px' }}>
          {/* Header: days */}
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{ gridTemplateColumns: `60px repeat(${currentWeek.dates.length}, 1fr)` }}
          >
            <div className="p-2 text-xs text-slate-400 font-medium border-r border-slate-200" />
            {currentWeek.dates.map(date => {
              const parsed = parseISO(date);
              return (
                <div key={date} className="p-2 text-center border-r border-slate-100 last:border-r-0">
                  <div className="text-xs font-semibold text-slate-600 capitalize">
                    {format(parsed, 'EEE', { locale: es })}
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {format(parsed, 'd MMM', { locale: es })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map(hour => (
            <div
              key={hour}
              className="grid"
              style={{ gridTemplateColumns: `60px repeat(${currentWeek.dates.length}, 1fr)` }}
            >
              <div className="flex items-start justify-end pr-2 pt-2 border-r border-b border-slate-200">
                <span className="text-xs text-slate-400 font-medium">{HOUR_LABELS[hour]}</span>
              </div>
              {currentWeek.dates.map(date => (
                <DroppableCell
                  key={date}
                  date={date}
                  hour={hour}
                  slots={weekSlots}
                  filterProfeId={filterProfeId}
                  filterIEId={filterIEId}
                  draggingSlot={draggingSlot}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Drag overlay: floating ghost card */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {draggingSlot ? (
          <DraggableSlotBadge slot={draggingSlot} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
