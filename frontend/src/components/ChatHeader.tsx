'use client';

import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { Phone, Video, Search, MoreVertical, ShieldCheck } from 'lucide-react';

export const ChatHeader: React.FC = () => {
  const { conversations, activeConversationId, currentUser, typingStatus, onlineUsers } = useChatStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  if (!conversation) return null;

  const isGroup = conversation.type === 'group';
  const otherMember = conversation.members.find((m) => m.user_id !== currentUser?.id)?.user;

  const title = isGroup ? (conversation.title || 'Group Chat') : (otherMember?.display_name || 'Contact');
  const avatar = isGroup
    ? (conversation.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=group')
    : (otherMember?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user');

  // Check if someone else is typing in this chat
  const typingUserIds = typingStatus[conversation.id] || [];
  const isOtherTyping = typingUserIds.some((id) => id !== currentUser?.id);

  // Online status
  const isOnline = !isGroup && otherMember
    ? onlineUsers.has(otherMember.id) || otherMember.is_online
    : false;

  return (
    <div className="h-16 px-4 border-b border-borderDark flex items-center justify-between bg-[#1A1A1A]/95 backdrop-blur z-10 flex-shrink-0">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="relative">
          <img
            src={avatar}
            alt={title}
            className="w-10 h-10 rounded-full object-cover bg-neutral-800"
          />
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1A1A1A] rounded-full" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5">
            <h2 className="text-sm font-semibold text-white truncate max-w-[200px] md:max-w-xs">
              {title}
            </h2>
            <span title="Signal E2E Verified" className="inline-flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 text-signalBlue" />
            </span>
          </div>

          <span className="text-xs text-iconMuted truncate">
            {isOtherTyping ? (
              <span className="text-signalBlue font-medium animate-pulse">typing...</span>
            ) : isGroup ? (
              `${conversation.members.length} members`
            ) : isOnline ? (
              <span className="text-green-400 font-normal">Active now</span>
            ) : (
              'Signal encrypted'
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 text-iconMuted">
        <button
          className="p-2 rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
          title="Voice Call (Coming Soon)"
        >
          <Phone className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
          title="Video Call (Coming Soon)"
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
          title="Search conversation"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
