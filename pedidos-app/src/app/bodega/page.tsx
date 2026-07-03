import React from 'react';
import BodegaBoard from '@/components/bodega/BodegaBoard';

export const metadata = { title: 'Bodega — Remisiones' };

export default function BodegaPage() {
  return (
    <main className="w-full">
      <BodegaBoard />
    </main>
  );
}
