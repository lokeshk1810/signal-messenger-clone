'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Paperclip, Smile, Send, Mic } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const [content, setContent] = useState('');
  const { sendMessage, sendTyping } = useChatStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    // Emit typing indicator
    sendTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 1500);
  };

  const handleSend = async () => {
    if (!content.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(false);

    await sendMessage(content);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 bg-canvas border-t border-borderDark flex items-center space-x-2">
      {/* Attachment Button */}
      <button
        type="button"
        className="p-2 rounded-full text-iconMuted hover:text-white hover:bg-[#262626] transition-colors"
        title="Add attachment (Coming Soon)"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Input Field Container */}
      <div className="flex-1 relative flex items-center">
        <input
          type="text"
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Signal message"
          className="w-full bg-[#1F1F1F] text-white placeholder-iconMuted text-sm rounded-2xl pl-4 pr-10 py-2.5 border border-transparent focus:border-borderDark focus:outline-none transition-all"
        />
        {/* Emoji Button inside input */}
        <button
          type="button"
          className="absolute right-3 text-iconMuted hover:text-white transition-colors"
          title="Insert emoji"
        >
          <Smile className="w-5 h-5" />
        </button>
      </div>

      {/* Send or Voice Record Button */}
      {content.trim() ? (
        <button
          type="button"
          onClick={handleSend}
          className="p-2.5 bg-signalBlue hover:bg-blue-600 text-white rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center"
          title="Send message"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      ) : (
        <button
          type="button"
          className="p-2.5 rounded-full text-iconMuted hover:text-white hover:bg-[#262626] transition-colors"
          title="Voice message (Coming Soon)"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
