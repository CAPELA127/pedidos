import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import { Lock, CheckCircle, ChevronDown, MapPin, X, Pencil } from 'lucide-react';
import type { Slot, Profe } from '../../types';
import { useStore, useCurrentWeek } from '../../store/useStore';
import { IES, HOURS } from '../../data/initial-data';

const HOUR_LABELS: Record<number, string> = {
  6: '6am', 7: '7am', 8: '8am', 9: '9am', 10: '10am', 11: '11am',
  12: '12pm', 13: '1pm', 14: '2pm', 15: '3pm', 16: '4pm', 17: '5pm',
};

const ALL_COMUNAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ─── Comunas editor modal ─────────────────────────────────────────────────────

function ComunasEditor({ profe, onClose }: { profe: Profe; onClose: () => void }) {
  const { updateProfeComunas } = useStore();
  const [principal, setPrincipal] = useState(profe.comuna);
  const [apoyo, setApoyo] = useState<number[]>(profe.comunasApoyo);

  function toggleApoyo(c: number) {
    if (c === principal) return; // la principal no puede ser apoyo
    setApoyo(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function handleSave() {
    // Remove principal from apoyo if it slipped in
    updateProfeComunas(profe.id, principal, apoyo.filter(c => c !== principal));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: profe.color + '18', borderBottom: `2px solid ${profe.color}33` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: profe.color }} />
            <span className="font-bold text-slate-800">{profe.nombre}</span>
            <span className="text-xs text-slate-500">— Comunas</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Principal */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <MapPin size={11} /> Comuna principal
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {ALL_COMUNAS.map(c => (
                <button
                  key={c}
                  onClick={() => { setPrincipal(c); setApoyo(prev => prev.filter(x => x !== c)); }}
                  className={clsx(
                    'h-9 rounded-lg text-sm font-bold transition-all border-2',
                    principal === c
                      ? 'text-white border-transparent shadow-md'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                  )}
                  style={principal === c ? { backgroundColor: profe.color, borderColor: profe.color } : {}}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Apoyo */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-600">Apoyo</span>
              Comunas de apoyo (opcional)
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {ALL_COMUNAS.map(c => {
                const isPrincipal = c === principal;
                const isSelected = apoyo.includes(c);
                return (
                  <button
                    key={c}
                    disabled={isPrincipal}
                    onClick={() => toggleApoyo(c)}
                    className={clsx(
                      'h-9 rounded-lg text-sm font-bold transition-all border-2',
                      isPrincipal && 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400',
                      !isPrincipal && isSelected && 'text-white border-transparent shadow-md bg-orange-500 border-orange-500',
                      !isPrincipal && !isSelected && 'bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-500'
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold" style={{ color: profe.color }}>Principal:</span> Comuna {principal}
            {apoyo.length > 0 && (
              <span className="ml-3">
                <span className="font-semibold text-orange-600">Apoyo:</span> {apoyo.sort((a,b)=>a-b).join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg text-sm text-white font-semibold shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: profe.color }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slot button ──────────────────────────────────────────────────────────────

function SlotButton({
  slot,
  profe,
  onAssign,
  onUnassign,
}: {
  slot: Slot;
  profe: Profe;
  onAssign: (slotId: string, ieId: string) => void;
  onUnassign: (slotId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ie = slot.ieId ? IES.find(i => i.id === slot.ieId) : null;
  const isApoyo = ie && ie.comuna !== profe.comuna;

  if (slot.status === 'unavailable') {
    return <div className="h-8 rounded bg-slate-100 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-slate-300" /></div>;
  }

  if (slot.status === 'blocked') {
    return (
      <div
        className="h-8 rounded flex items-center justify-center gap-1 px-1"
        style={{ backgroundColor: profe.color + '33', border: `1.5px solid ${profe.color}` }}
        title={`Bloqueado: ${ie?.nombre ?? ''}`}
      >
        <Lock size={10} style={{ color: profe.color }} />
        <span className="text-xs font-semibold truncate" style={{ color: profe.color }}>
          {ie?.nombre ? ie.nombre.substring(0, 7) + '…' : 'Bloqueado'}
        </span>
        {isApoyo && (
          <span className="shrink-0 text-xs bg-orange-500 text-white px-1 py-0.5 rounded font-bold leading-none">
            Apoyo
          </span>
        )}
      </div>
    );
  }

  if (slot.status === 'assigned' && ie) {
    return (
      <button
        onClick={() => onUnassign(slot.id)}
        className="h-8 rounded flex items-center justify-center gap-1 px-1.5 w-full hover:opacity-80 transition-opacity"
        style={{ backgroundColor: profe.color, color: 'white' }}
        title={`${ie.nombre}${isApoyo ? ' — Apoyo' : ''} — clic para desasignar`}
      >
        <CheckCircle size={10} />
        <span className="text-xs font-semibold truncate flex-1 text-left">{ie.nombre.substring(0, 7)}</span>
        {isApoyo && (
          <span className="shrink-0 text-xs bg-white/30 text-white px-1 py-0.5 rounded font-bold leading-none">
            Apoyo
          </span>
        )}
      </button>
    );
  }

  // Available
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 rounded w-full flex items-center justify-center gap-1 border-2 border-dashed border-green-300 hover:border-green-500 hover:bg-green-50 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <ChevronDown size={10} className="text-green-600" />
      </button>

      {open && (
        <div className="absolute z-50 top-9 left-0 w-56 bg-white shadow-xl border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-600">Asignar IE</p>
          </div>
          <div className="max-h-48 overflow-auto">
            {IES.map(ie => {
              const ieIsApoyo = ie.comuna !== profe.comuna;
              return (
                <button
                  key={ie.id}
                  onClick={() => { onAssign(slot.id, ie.id); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="truncate">{ie.nombre}</span>
                  <div className="flex gap-1 shrink-0 items-center">
                    {ieIsApoyo && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">
                        Apoyo
                      </span>
                    )}
                    <span className={clsx(
                      'text-xs px-1.5 py-0.5 rounded',
                      ie.tipo === 'Fijo' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {ie.tipo === 'Fijo' ? 'F' : 'R'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => setOpen(false)} className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-600 border-t border-slate-100">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ProfeView() {
  const currentWeek = useCurrentWeek();
  const allSlots = useStore(s => s.slots);
  const profes = useStore(s => s.profes);
  const { assignSlot, unassignSlot } = useStore();

  const [selectedProfeId, setSelectedProfeId] = useState(profes[0].id);
  const [editingComunas, setEditingComunas] = useState(false);

  const profe = profes.find(p => p.id === selectedProfeId)!;
  const profeSlots = allSlots.filter(
    s => s.profeId === selectedProfeId && currentWeek.dates.includes(s.date)
  );

  const assignedCount = profeSlots.filter(s => s.status === 'assigned' || s.status === 'blocked').length;
  const availableCount = profeSlots.filter(s => s.status === 'available').length;
  const apoyoCount = profeSlots.filter(s => {
    if (s.status !== 'assigned' && s.status !== 'blocked') return false;
    const ie = IES.find(i => i.id === s.ieId);
    return ie && ie.comuna !== profe.comuna;
  }).length;

  return (
    <div>
      {editingComunas && (
        <ComunasEditor profe={profe} onClose={() => setEditingComunas(false)} />
      )}

      {/* Teacher selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {profes.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProfeId(p.id)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm',
              selectedProfeId === p.id
                ? 'text-white shadow-md scale-105'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            )}
            style={selectedProfeId === p.id ? { backgroundColor: p.color } : {}}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Profe header card */}
      <div
        className="rounded-xl p-4 mb-5 flex items-center justify-between"
        style={{ backgroundColor: profe.color + '12', border: `1.5px solid ${profe.color}33` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow"
            style={{ backgroundColor: profe.color }}>
            {profe.nombre[0]}
          </div>
          <div>
            <p className="font-bold text-slate-800">{profe.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: profe.color }}>
                <MapPin size={9} /> C{profe.comuna} Principal
              </span>
              {profe.comunasApoyo.length > 0 && profe.comunasApoyo.map(c => (
                <span key={c} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                  <MapPin size={9} /> C{c} Apoyo
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditingComunas(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-white hover:shadow-sm transition-all"
        >
          <Pencil size={11} /> Editar comunas
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold" style={{ color: profe.color }}>{assignedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Horas asignadas</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-green-600">{availableCount}</div>
          <div className="text-xs text-slate-500 mt-1">Horas disponibles</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-bold text-orange-500">{apoyoCount}</div>
          <div className="text-xs text-slate-500 mt-1">Horas en apoyo</div>
        </div>
      </div>

      {/* Availability grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Disponibilidad — {profe.nombre}</h3>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400 inline-block" /> Disponible</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded inline-block" style={{ backgroundColor: profe.color }} /> Asignado</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400 inline-block" /> Apoyo</span>
            <span className="flex items-center gap-1"><Lock size={10} style={{ color: profe.color }} /> Bloqueado</span>
          </div>
        </div>

        <div style={{ minWidth: '700px' }}>
          <div
            className="grid bg-slate-50 border-b border-slate-200"
            style={{ gridTemplateColumns: '60px repeat(' + currentWeek.dates.length + ', 1fr)' }}
          >
            <div className="p-2 border-r border-slate-200" />
            {currentWeek.dates.map(date => {
              const parsed = parseISO(date);
              return (
                <div key={date} className="p-2 text-center border-r border-slate-100 last:border-r-0">
                  <div className="text-xs font-semibold text-slate-600 capitalize">
                    {format(parsed, 'EEE', { locale: es })}
                  </div>
                  <div className="text-xs text-slate-500">{format(parsed, 'd MMM', { locale: es })}</div>
                </div>
              );
            })}
          </div>

          {HOURS.map(hour => (
            <div
              key={hour}
              className="grid border-b border-slate-100 last:border-b-0"
              style={{ gridTemplateColumns: '60px repeat(' + currentWeek.dates.length + ', 1fr)' }}
            >
              <div className="flex items-center justify-end pr-2 border-r border-slate-200 py-1">
                <span className="text-xs text-slate-400 font-medium">{HOUR_LABELS[hour]}</span>
              </div>
              {currentWeek.dates.map(date => {
                const slot = profeSlots.find(s => s.date === date && s.hour === hour);
                return (
                  <div key={date} className="p-1 border-r border-slate-100 last:border-r-0">
                    {slot ? (
                      <SlotButton slot={slot} profe={profe} onAssign={assignSlot} onUnassign={unassignSlot} />
                    ) : (
                      <div className="h-8 rounded bg-slate-50" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
