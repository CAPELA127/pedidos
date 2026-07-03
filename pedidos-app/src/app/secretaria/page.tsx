import React from 'react';
import RemissionsInbox from '@/components/remissions/RemissionsInbox';

export const metadata = { title: 'Portal de Secretaría' };

export default function SecretariaPage() {
  return (
    <main className="w-full">
      <RemissionsInbox role="secretaria" />
    </main>
  );
}
