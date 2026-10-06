import { create } from 'zustand';
import { User, Conversation, Message, MessageStatus } from '../types';

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

interface TypingMap {
  [conversationId: number]: {
    [userId: number]: { isTyping: boolean; timeout?: any };
  };
}

interface ChatState {
  currentUser: User | null;
  allUsers: User[];
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Message[];
  onlineUsers: Set<number>;
  typingStatus: { [conversationId: number]: number[] }; // user_ids typing in conv
  socket: WebSocket | null;
  isConnected: boolean;

  // Actions
  fetchInitialData: () => Promise<void>;
  switchUser: (user: User) => void;
  setActiveConversation: (conversationId: number) => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  markConversationAsRead: (conversationId: number) => Promise<void>;
  createDirectConversation: (targetUserId: number) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentUser: null,
  allUsers: [],
  conversations: [],
  activeConversationId: null,
  messages: [],
  onlineUsers: new Set<number>(),
  typingStatus: {},
  socket: null,
  isConnected: false,

  fetchInitialData: async () => {
    try {
      const usersRes = await fetch(`${API_BASE}/users`);
      if (usersRes.ok) {
        const users: User[] = await usersRes.json();
        set({ allUsers: users });

        // Set default current user to Alice (ID: 1) if not already set
        const current = get().currentUser || users.find(u => u.id === 1) || users[0];
        if (current) {
          get().switchUser(current);
        }
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  },

  switchUser: (user: User) => {
    get().disconnectWebSocket();
    set({
      currentUser: user,
      activeConversationId: null,
      messages: [],
      conversations: [],
    });

    // Re-connect WebSocket for new user
    get().connectWebSocket();

    // Fetch user's conversations
    fetch(`${API_BASE}/conversations/${user.id}`)
      .then((res) => res.json())
      .then((convs: Conversation[]) => {
        set({ conversations: convs });
        // Automatically select first conversation if available
        if (convs.length > 0) {
          get().setActiveConversation(convs[0].id);
        }
      })
      .catch((err) => console.error('Error fetching conversations:', err));
  },

  setActiveConversation: async (conversationId: number) => {
    set({ activeConversationId: conversationId });
    await get().fetchMessages(conversationId);
    await get().markConversationAsRead(conversationId);
  },

  fetchMessages: async (conversationId: number) => {
    try {
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
      if (res.ok) {
        const msgs: Message[] = await res.json();
        set({ messages: msgs });
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  },

  sendMessage: async (content: string) => {
    const { currentUser, activeConversationId, socket } = get();
    if (!currentUser || !activeConversationId || !content.trim()) return;

    const payload = {
      conversation_id: activeConversationId,
      content: content.trim(),
    };

    // If socket is open, send via WebSocket for immediate real-time delivery
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'send_message',
          data: payload,
        })
      );
    } else {
      // Fallback to REST API
      try {
        await fetch(
          `${API_BASE}/conversations/${activeConversationId}/messages?sender_id=${currentUser.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.trim() }),
          }
        );
      } catch (e) {
        console.error('Failed to send message via REST:', e);
      }
    }
  },

  sendTyping: (isTyping: boolean) => {
    const { socket, activeConversationId } = get();
    if (socket && socket.readyState === WebSocket.OPEN && activeConversationId) {
      socket.send(
        JSON.stringify({
          type: 'typing',
          data: {
            conversation_id: activeConversationId,
            is_typing: isTyping,
          },
        })
      );
    }
  },

  markConversationAsRead: async (conversationId: number) => {
    const { currentUser, messages, socket, conversations } = get();
    if (!currentUser) return;

    // Send read receipts for unread messages sent by others
    messages.forEach((msg) => {
      if (msg.sender_id !== currentUser.id && msg.status !== 'read') {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'message_read',
              data: {
                message_id: msg.id,
                status: 'read',
              },
            })
          );
        }
      }
    });

    // Reset unread_count for this conversation locally
    set({
      conversations: conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    });
  },

  createDirectConversation: async (targetUserId: number) => {
    const { currentUser } = get();
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'direct',
          member_ids: [currentUser.id, targetUserId],
          creator_id: currentUser.id,
        }),
      });
      if (res.ok) {
        const newConv: Conversation = await res.json();
        const existing = get().conversations.find((c) => c.id === newConv.id);
        if (!existing) {
          set({ conversations: [newConv, ...get().conversations] });
        }
        await get().setActiveConversation(newConv.id);
      }
    } catch (e) {
      console.error('Failed to create direct conversation:', e);
    }
  },

  connectWebSocket: () => {
    const { currentUser } = get();
    if (!currentUser) return;

    const wsUrl = `${WS_BASE}/ws/${currentUser.id}`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('WebSocket connection error:', e);
      return;
    }

    ws.onopen = () => {
      set({ isConnected: true, socket: ws });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;

        // 1. New Message
        if (type === 'new_message') {
          const newMsg: Message = data;
          const { activeConversationId, conversations, currentUser } = get();

          // If current active conversation, append message
          if (activeConversationId === newMsg.conversation_id) {
            set((state) => ({
              messages: [...state.messages, newMsg],
            }));

            // Mark as read immediately if current user is viewing and not sender
            if (currentUser && newMsg.sender_id !== currentUser.id) {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'message_read',
                    data: { message_id: newMsg.id, status: 'read' },
                  })
                );
              }
            }
          }

          // Update conversation list item last_message and sort by updated
          set((state) => {
            const updatedConvs = state.conversations.map((c) => {
              if (c.id === newMsg.conversation_id) {
                const isViewing = activeConversationId === c.id;
                const unreadInc = !isViewing && newMsg.sender_id !== currentUser?.id ? 1 : 0;
                return {
                  ...c,
                  last_message: newMsg,
                  updated_at: newMsg.created_at,
                  unread_count: c.unread_count + unreadInc,
                };
              }
              return c;
            });
            // Re-order by recent activity
            updatedConvs.sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            return { conversations: updatedConvs };
          });
        }

        // 2. Typing indicator
        else if (type === 'typing') {
          const { conversation_id, user_id, is_typing } = data;
          set((state) => {
            const currentList = state.typingStatus[conversation_id] || [];
            let updatedList = [...currentList];
            if (is_typing && !updatedList.includes(user_id)) {
              updatedList.push(user_id);
            } else if (!is_typing && updatedList.includes(user_id)) {
              updatedList = updatedList.filter((id) => id !== user_id);
            }
            return {
              typingStatus: {
                ...state.typingStatus,
                [conversation_id]: updatedList,
              },
            };
          });
        }

        // 3. Presence update
        else if (type === 'presence_update') {
          const { user_id, is_online } = data;
          set((state) => {
            const newOnline = new Set(state.onlineUsers);
            if (is_online) {
              newOnline.add(user_id);
            } else {
              newOnline.delete(user_id);
            }

            // Also update allUsers list
            const updatedUsers = state.allUsers.map((u) =>
              u.id === user_id ? { ...u, is_online } : u
            );

            // Also update conversation members list
            const updatedConvs = state.conversations.map((c) => ({
              ...c,
              members: c.members.map((m) =>
                m.user.id === user_id ? { ...m, user: { ...m.user, is_online } } : m
              ),
            }));

            return {
              onlineUsers: newOnline,
              allUsers: updatedUsers,
              conversations: updatedConvs,
            };
          });
        }

        // 4. Receipt update
        else if (type === 'receipt_update') {
          const { message_id, status } = data;
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === message_id ? { ...m, status: status as MessageStatus } : m
            ),
          }));
        }
      } catch (err) {
        console.error('Failed to process WebSocket event:', err);
      }
    };

    ws.onclose = () => {
      set({ isConnected: false, socket: null });
      // Auto-reconnect after 3 seconds if current user exists
      setTimeout(() => {
        if (get().currentUser) {
          get().connectWebSocket();
        }
      }, 3000);
    };

    set({ socket: ws });
  },

  disconnectWebSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },
}));
