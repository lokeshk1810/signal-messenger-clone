'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Sidebar } from '../components/Sidebar';
import { ChatHeader } from '../components/ChatHeader';
import { MessageFeed } from '../components/MessageFeed';
import { ChatInput } from '../components/ChatInput';
import { Shield, MessageSquare } from 'lucide-react';

export default function Home() {
  const { fetchInitialData, activeConversationId } = useChatStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-canvas">
      {/* Sidebar with conversation list */}
      <Sidebar />

      {/* Main Chat Pane */}
      <div className="flex-1 flex flex-col h-full bg-canvas relative">
        {activeConversationId ? (
          <>
            <ChatHeader />
            <MessageFeed />
            <ChatInput />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#141414]">
            <div className="w-16 h-16 rounded-full bg-[#1E1E1E] border border-borderDark flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-signalBlue" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Signal for Desktop</h2>
            <p className="text-xs text-iconMuted max-w-sm leading-relaxed mb-6">
              Select a chat to begin messaging with end-to-end privacy and real-time delivery.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
