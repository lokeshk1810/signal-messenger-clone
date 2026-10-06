export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface User {
  id: number;
  username: string;
  phone_number?: string | null;
  display_name: string;
  avatar_url?: string | null;
  status_message?: string | null;
  is_online: boolean;
  last_seen?: string | null;
  created_at: string;
}

export interface MessageReceipt {
  user_id: number;
  status: MessageStatus;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  status: MessageStatus;
  created_at: string;
  receipts: MessageReceipt[];
}

export interface ConversationMember {
  user_id: number;
  is_admin: boolean;
  joined_at: string;
  user: User;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  title?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message?: Message | null;
  unread_count: number;
}
