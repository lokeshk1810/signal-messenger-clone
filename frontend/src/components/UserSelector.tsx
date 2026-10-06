'use client';

import React from 'react';
import { useChatStore } from '../store/useChatStore';
import { User } from '../types';
import { Users, ChevronDown } from 'lucide-react';

export const UserSelector: React.FC = () => {
  const { currentUser, allUsers, switchUser, isConnected } = useChatStore();

  return (
    <div className="flex items-center justify-between p-3 border-b border-borderDark bg-[#1A1A1A]">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <img
            src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
            alt={currentUser?.display_name || 'User'}
            className="w-8 h-8 rounded-full bg-neutral-800 object-cover ring-1 ring-[#333]"
          />
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1A1A1A] ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={isConnected ? 'Connected' : 'Connecting...'}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white leading-tight">
            {currentUser?.display_name || 'Loading...'}
          </span>
          <span className="text-[10px] text-iconMuted">
            Logged in as @{currentUser?.username || 'user'}
          </span>
        </div>
      </div>

      <div className="relative flex items-center">
        <label htmlFor="user-switch" className="sr-only">Switch User</label>
        <select
          id="user-switch"
          value={currentUser?.id || ''}
          onChange={(e) => {
            const selected = allUsers.find((u) => u.id === Number(e.target.value));
            if (selected) switchUser(selected);
          }}
          className="appearance-none bg-[#262626] hover:bg-[#303030] text-xs font-medium text-gray-200 py-1.5 pl-3 pr-8 rounded-md border border-borderDark focus:outline-none focus:ring-1 focus:ring-signalBlue transition-all cursor-pointer"
        >
          {allUsers.map((u) => (
            <option key={u.id} value={u.id} className="bg-[#262626] text-white">
              Switch to {u.display_name} ({u.username})
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-iconMuted absolute right-2.5 pointer-events-none" />
      </div>
    </div>
  );
};
