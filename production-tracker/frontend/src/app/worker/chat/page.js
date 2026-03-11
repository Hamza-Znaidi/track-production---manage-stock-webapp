'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import ChatThreadList from '@/components/ChatThreadList';
import ChatThread from '@/components/ChatThread';
import { initSocket, disconnectSocket } from '@/lib/socket';
import { MessageCircle, MessageCirclePlus } from 'lucide-react';

export default function WorkerChatPage() {
  const router = useRouter();
  const [state, setState] = useState({
    user: null,
    selectedThreadId: null,
    isLoading: true,
  });

  const { user, selectedThreadId, isLoading } = state;

  const handleSelectThread = (threadId) => {
    setState(prev => ({ ...prev, selectedThreadId: threadId }));
  };

  // Auth check and initialization - runs only on client after hydration
  useLayoutEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser?.role !== 'WORKER') {
      router.push('/admin');
      return;
    }

    setState({
      user: currentUser,
      selectedThreadId: null,
      isLoading: false,
    });
  }, [router]);

  // Initialize socket once - separate from auth to prevent reconnects
  useLayoutEffect(() => {
    initSocket();

    return () => {
      disconnectSocket();
    };
  }, []);

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="WORKER" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chat</h1>
              <p className="text-gray-600 mt-1">Real-time messaging</p>
            </div>
            <NotificationBell role="WORKER" />
          </div>
        </header>

        <main className="p-4 sm:p-8 modern-enter">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
            {/* Thread list */}
            <div className="lg:col-span-1">
              <ChatThreadList
                onSelectThread={handleSelectThread}
                selectedThreadId={selectedThreadId}
                currentUserId={user?.id}
                currentUserRole={user?.role}
              />
            </div>

            {/* Chat view */}
            <div className="lg:col-span-3">
              {selectedThreadId ? (
                <ChatThread
                  threadId={selectedThreadId}
                  currentUserId={user?.id}
                  onClose={() => handleSelectThread(null)}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center flex items-center justify-center h-full">
                  <div>
                    <MessageCirclePlus className="w-14 h-14 mb-4 mx-auto " />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Start a Conversation</h3>
                    <p className="text-gray-500">Select a thread from the list to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
