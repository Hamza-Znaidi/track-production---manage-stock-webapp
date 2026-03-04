'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import chatAPI from '@/lib/chat';
import api from '@/lib/axios';
import { MessageCircle } from 'lucide-react';
import { confirmToast, notifyError } from '@/lib/toast';


export default function ChatThreadList({
  onSelectThread,
  selectedThreadId,
  onNewThread,
  currentUserId,
  currentUserRole,
}) {
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'direct', 'workorder'
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState(null);

  useEffect(() => {
    const loadThreads = async () => {
      try {
        setIsLoading(true);
        const data = await chatAPI.getThreads();
        setThreads(data);
      } catch (err) {
        notifyError('Failed to load conversations');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadThreads();
  }, []);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.get('/auth/chat-users');
      const payload = response.data;
      const normalizedUsers = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.users)
          ? payload.users
          : [];
      setUsers(normalizedUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load users';
      notifyError(`Error: ${errorMsg}`);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const createDirectMessage = async (userId) => {
    try {
      const thread = await chatAPI.getOrCreateDMThread(userId);
      setThreads((prev) => {
        const existing = prev.find((t) => t.id === thread.id);
        if (existing) return prev;
        return [thread, ...prev];
      });
      onSelectThread(thread.id);
      if (onNewThread) onNewThread(thread.id);
      setShowNewChatModal(false);
    } catch (err) {
      console.error('Failed to create chat:', err);
      notifyError(`Failed to start chat: ${err.response?.data?.error || err.message || 'Unknown error'}`);
    }
  };

  const handleOpenNewChat = () => {
    setShowNewChatModal(true);
    loadUsers();
  };

  const filteredThreads = threads.filter((thread) => {
    if (filter === 'all') return true;
    if (filter === 'direct') return thread.type === 'DIRECT';
    if (filter === 'workorder') return thread.type === 'WORK_ORDER';
    return true;
  });

  const formatPreview = (message) => {
    if (!message) return 'No messages yet';
    return `${message.sender?.username || 'Someone'}: ${message.content?.substring(0, 40)}${message.content?.length > 40 ? '...' : ''}`;
  };

  const formatTime = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return then.toLocaleDateString();
  };

  const canDeleteThread = (thread) => {
    if (currentUserRole !== 'ADMIN') return false;
    if (thread.type === 'WORK_ORDER') return true;
    if (thread.type === 'DIRECT') {
      return thread.participants?.some((participant) => participant.userId === currentUserId);
    }
    return false;
  };

  const handleDeleteThread = async (threadId, event) => {
    event.stopPropagation();

    confirmToast({
      title: 'Delete this chat thread?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          setDeletingThreadId(threadId);
          await chatAPI.deleteThread(threadId);

          setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
          if (selectedThreadId === threadId) {
            onSelectThread(null);
          }
        } catch (err) {
          const errorMessage = err.response?.data?.error || 'Failed to delete thread';
          notifyError(errorMessage);
        } finally {
          setDeletingThreadId(null);
        }
      },
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900"><MessageCircle className='inline'/> &nbsp;  Messages</h2>
          <button
            onClick={handleOpenNewChat}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 transition"
            title="Start new chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'direct', label: 'Direct' },
            { value: 'workorder', label: 'Work Orders' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                filter === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Threads list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p className="text-sm">
              {filter === 'all'
                ? 'No conversations yet. Start a new chat!'
                : `No ${filter === 'direct' ? 'direct' : 'work order'} conversations.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredThreads.map((thread) => {
              const isSelected = thread.id === selectedThreadId;
              const otherUser = thread.type === 'DIRECT'
                ? thread.participants?.find((p) => p.userId !== currentUserId)?.user
                : null;
              const threadName =
                thread.type === 'DIRECT'
                  ? otherUser?.username || 'Unknown'
                  : thread.workOrder?.workOrderNumber || thread.name || 'Work Order';

              return (
                <div
                  key={thread.id}
                  className={`px-6 py-4 transition flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectThread(thread.id);
                      setThreads((prev) =>
                        prev.map((currentThread) =>
                          currentThread.id === thread.id
                            ? { ...currentThread, unreadCount: 0 }
                            : currentThread
                        )
                      );
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{threadName}</p>
                      {thread.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    {thread.type === 'WORK_ORDER' && thread.workOrder && (
                      <p className="text-xs text-gray-500">{thread.workOrder.client}</p>
                    )}
                    <p className="text-sm text-gray-600 truncate">
                      {formatPreview(thread.messages?.[0])}
                    </p>
                  </button>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {formatTime(thread.messages?.[0]?.createdAt || thread.updatedAt)}
                    </span>
                    {canDeleteThread(thread) && (
                      <button
                        onClick={(event) => handleDeleteThread(thread.id, event)}
                        disabled={deletingThreadId === thread.id}
                        className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                        title="Delete thread"
                      >
                        {deletingThreadId === thread.id ? 'Deleting...' : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Start a Chat</h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : !Array.isArray(users) || users.length === 0 ? (
                <p className="text-gray-500 text-sm">No other users available</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => createDirectMessage(user.id)}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-lg transition flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                        {user.username.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
