import React from 'react';
import RemissionsInbox from '@/components/remissions/RemissionsInbox';

export const metadata = { title: 'Portal del Vendedor' };

export default function VendedorPage() {
  return (
    <main className="w-full">
      <RemissionsInbox role="vendedor" />
    </main>
  );
}
