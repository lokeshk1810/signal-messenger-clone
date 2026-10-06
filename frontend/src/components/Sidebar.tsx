'use client';

import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { UserSelector } from './UserSelector';
import { Conversation, User } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Search,
  MessageSquarePlus,
  Settings,
  MoreVertical,
  Check,
  CheckCheck,
  UserPlus,
  Users,
  Shield,
  X,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    currentUser,
    allUsers,
    createDirectConversation,
    onlineUsers,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const formatMessageTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isToday(date)) return format(date, 'h:mm a');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  const getConversationDetails = (conv: Conversation) => {
    if (conv.type === 'group') {
      return {
        title: conv.title || 'Group Chat',
        avatar: conv.avatar_url || 'https://api.dicebear.com/7.x/identicon/svg?seed=group',
        isOnline: false,
      };
    }
    // Direct chat - get the other member
    const otherMember = conv.members.find((m) => m.user_id !== currentUser?.id)?.user;
    const isOnline = otherMember ? onlineUsers.has(otherMember.id) || otherMember.is_online : false;
    return {
      title: otherMember?.display_name || 'Direct Chat',
      avatar: otherMember?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
      isOnline,
    };
  };

  const filteredConversations = conversations.filter((c) => {
    const details = getConversationDetails(c);
    return details.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-80 md:w-96 h-full flex flex-col bg-sidebar border-r border-borderDark flex-shrink-0 select-none">
      {/* User Switcher header */}
      <UserSelector />

      {/* Signal Brand Header & Actions */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-full bg-signalBlue flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">Signal</h1>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 rounded-full hover:bg-[#2A2A2A] text-iconMuted hover:text-white transition-colors"
            title="New Chat"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-full hover:bg-[#2A2A2A] text-iconMuted hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-iconMuted absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] text-xs text-white placeholder-iconMuted pl-9 pr-4 py-2 rounded-lg border border-transparent focus:border-borderDark focus:outline-none focus:bg-[#1A1A1A] transition-all"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#242424]/40">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-iconMuted flex flex-col items-center">
            <Users className="w-8 h-8 mb-2 opacity-40" />
            No conversations found.
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const { title, avatar, isOnline } = getConversationDetails(conv);
            const isActive = activeConversationId === conv.id;
            const lastMsg = conv.last_message;

            return (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`flex items-center px-3 py-3 cursor-pointer transition-colors relative group ${
                  isActive
                    ? 'bg-[#2A2A2A]'
                    : 'hover:bg-[#242424]'
                }`}
              >
                {/* Avatar with Online Badge */}
                <div className="relative mr-3 flex-shrink-0">
                  <img
                    src={avatar}
                    alt={title}
                    className="w-12 h-12 rounded-full bg-neutral-800 object-cover"
                  />
                  {isOnline && conv.type === 'direct' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-sidebar rounded-full" />
                  )}
                </div>

                {/* Conversation Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-white truncate max-w-[160px]">
                      {title}
                    </span>
                    {lastMsg && (
                      <span className="text-[11px] text-iconMuted whitespace-nowrap">
                        {formatMessageTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-iconMuted truncate pr-2">
                      {/* Outgoing Message Status Icon */}
                      {lastMsg && lastMsg.sender_id === currentUser?.id && (
                        <span className="mr-1 inline-flex items-center">
                          {lastMsg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-signalBlue" />
                          ) : lastMsg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-iconMuted" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-iconMuted" />
                          )}
                        </span>
                      )}
                      <span className="truncate">
                        {lastMsg ? lastMsg.content : 'No messages yet'}
                      </span>
                    </div>

                    {/* Unread Badge */}
                    {conv.unread_count > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-signalBlue text-white rounded-full flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-borderDark rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-borderDark flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-signalBlue" />
                New Conversation
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-iconMuted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-72 overflow-y-auto">
              <p className="text-xs text-iconMuted px-3 py-1.5 uppercase tracking-wider font-semibold">
                Contacts
              </p>
              {allUsers
                .filter((u) => u.id !== currentUser?.id)
                .map((user) => (
                  <div
                    key={user.id}
                    onClick={async () => {
                      await createDirectConversation(user.id);
                      setShowNewChatModal(false);
                    }}
                    className="flex items-center p-2.5 hover:bg-[#2A2A2A] rounded-lg cursor-pointer transition-colors"
                  >
                    <img
                      src={user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                      alt={user.display_name}
                      className="w-10 h-10 rounded-full mr-3 bg-neutral-800"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {user.display_name}
                      </span>
                      <span className="text-xs text-iconMuted">
                        @{user.username} {user.phone_number ? `• ${user.phone_number}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
