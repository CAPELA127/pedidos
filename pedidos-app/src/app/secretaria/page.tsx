'use client';

import React, { useState } from 'react';
import RemissionsInbox from '@/components/remissions/RemissionsInbox';
import SecretariaOrdersBoard from '@/components/secretaria/SecretariaOrdersBoard';

export default function SecretariaPage() {
  const [tab, setTab] = useState<'pedidos' | 'remisiones'>('pedidos');

  return (
    <main className="w-full">
      <div className="bg-white border-b flex sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => setTab('pedidos')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === 'pedidos' ? 'text-[#7c3aed] border-b-2 border-[#7c3aed]' : 'text-gray-400'}`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setTab('remisiones')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === 'remisiones' ? 'text-[#7c3aed] border-b-2 border-[#7c3aed]' : 'text-gray-400'}`}
        >
          Remisiones
        </button>
      </div>
      {tab === 'pedidos' ? <SecretariaOrdersBoard /> : <RemissionsInbox role="secretaria" />}
    </main>
  );
}
