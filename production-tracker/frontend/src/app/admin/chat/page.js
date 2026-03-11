'use client';

import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import authService from '@/lib/auth';
import { MessageCirclePlus } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import ChatThreadList from '@/components/ChatThreadList';
import ChatThread from '@/components/ChatThread';
import { initSocket, disconnectSocket } from '@/lib/socket';

function AdminChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState({
    user: null,
    selectedThreadId: null,
    isLoading: true,
  });

  const { user, selectedThreadId, isLoading } = state;

  const handleSelectThread = (threadId) => {
    setState(prev => ({ ...prev, selectedThreadId: threadId }));
  };

  // Auth check and initialization - runs only once on mount
  useLayoutEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser.role !== 'ADMIN') {
      router.push('/admin');
      return;
    }

    // Initialize thread from URL params
    const threadParam = searchParams.get('thread');
    let selectedThreadId = null;
    if (threadParam) {
      const parsedThreadId = parseInt(threadParam, 10);
      if (!Number.isNaN(parsedThreadId)) {
        selectedThreadId = parsedThreadId;
      }
    }

    setState({
      user: currentUser,
      selectedThreadId,
      isLoading: false,
    });
  }, [router, searchParams]);

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

  // Update selected thread when URL params change
  useLayoutEffect(() => {
    const threadParam = searchParams.get('thread');
    const parsedThreadId = threadParam ? parseInt(threadParam, 10) : null;
    
    if (!Number.isNaN(parsedThreadId) && selectedThreadId !== parsedThreadId) {
      setState(prev => ({ ...prev, selectedThreadId: parsedThreadId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="ADMIN" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chat</h1>
              <p className="text-gray-600 mt-1">Real-time messaging</p>
            </div>
            <NotificationBell role="ADMIN" />
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
                    <div className="text-6xl mb-4 inline "><MessageCirclePlus className='mx-auto mb-5 size-15' /></div>
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

export default function AdminChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
      <AdminChatPageContent />
    </Suspense>
  );
}
