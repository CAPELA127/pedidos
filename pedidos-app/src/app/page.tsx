import React from 'react';
import ChatInterface from '@/components/chat/ChatInterface';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#efeae2]">
      <ChatInterface />
    </main>
  );
}
