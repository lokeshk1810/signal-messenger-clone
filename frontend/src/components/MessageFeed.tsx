'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { format } from 'date-fns';
import { Check, CheckCheck, Lock } from 'lucide-react';
import { Message } from '../types';

export const MessageFeed: React.FC = () => {
  const { messages, currentUser, conversations, activeConversationId, typingStatus } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const isGroup = conversation?.type === 'group';

  const typingUserIds = activeConversationId ? typingStatus[activeConversationId] || [] : [];
  const otherTypingIds = typingUserIds.filter((id) => id !== currentUser?.id);

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTypingIds]);

  const renderStatus = (msg: Message) => {
    if (msg.status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-signalBlue ml-1 inline" />;
    }
    if (msg.status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-gray-300 ml-1 inline" />;
    }
    return <Check className="w-3.5 h-3.5 text-gray-400 ml-1 inline" />;
  };

  const getSenderName = (senderId: number) => {
    const member = conversation?.members.find((m) => m.user_id === senderId);
    return member?.user.display_name || 'Member';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
      {/* End-to-End Encryption Notice Banner */}
      <div className="flex justify-center my-4">
        <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg px-3 py-1.5 flex items-center space-x-1.5 shadow-sm max-w-md text-center">
          <Lock className="w-3 h-3 text-iconMuted flex-shrink-0" />
          <p className="text-[11px] text-iconMuted">
            Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
          </p>
        </div>
      </div>

      {/* Message List */}
      {messages.map((msg, index) => {
        const isOutgoing = msg.sender_id === currentUser?.id;
        const msgTime = format(new Date(msg.created_at), 'h:mm a');

        return (
          <div
            key={msg.id || index}
            className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
          >
            {/* Group Sender Label */}
            {!isOutgoing && isGroup && (
              <span className="text-[11px] font-medium text-signalBlue px-2 mb-0.5">
                {getSenderName(msg.sender_id)}
              </span>
            )}

            <div
              className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm break-words shadow-sm relative ${
                isOutgoing
                  ? 'bg-signalBlue text-white rounded-br-xs'
                  : 'bg-incomingBubble text-[#E1E1E1] rounded-bl-xs'
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

              <div
                className={`flex items-center justify-end space-x-1 text-[10px] mt-1 select-none ${
                  isOutgoing ? 'text-blue-100/80' : 'text-iconMuted'
                }`}
              >
                <span>{msgTime}</span>
                {isOutgoing && renderStatus(msg)}
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing Bubble */}
      {otherTypingIds.length > 0 && (
        <div className="flex items-center space-x-2">
          <div className="bg-incomingBubble text-iconMuted rounded-2xl rounded-bl-xs px-3.5 py-2 flex items-center space-x-1 shadow-sm">
            <span className="w-1.5 h-1.5 bg-iconMuted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-iconMuted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-iconMuted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
