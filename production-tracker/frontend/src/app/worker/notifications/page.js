'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import notificationsApi from '@/lib/notifications';
import { confirmToast, notifyError, notifySuccess } from '@/lib/toast';

const TYPE_LABELS = {
  STAGE_ASSIGNED: 'Assignment',
  STAGE_STATUS_CHANGED: 'Stage Update',
  LOW_STOCK: 'Low Stock',
  CHAT_MESSAGE: 'Chat Message',
};

const SEVERITY_CLASS = {
  INFO: 'bg-blue-50 text-blue-700 border-blue-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

export default function WorkerNotificationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const LIMIT = 20;

  const fetchNotifications = useCallback(async ({ reset = false, silent = false, startOffset = 0 } = {}) => {
    const nextOffset = reset ? 0 : startOffset;

    if (!silent) {
      if (reset) setIsLoading(true);
      else setIsLoadingMore(true);
    }

    try {
      const data = await notificationsApi.getNotifications({
        limit: LIMIT,
        offset: nextOffset,
      });

      const incoming = data.notifications || [];
      setTotal(data.total || 0);
      setOffset(nextOffset + incoming.length);

      if (reset) {
        setNotifications(incoming);
      } else {
        setNotifications((prev) => [...prev, ...incoming]);
      }
    } catch (apiError) {
      notifyError(apiError.response?.data?.error || 'Failed to load notifications');
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser.role !== 'WORKER') {
      router.push('/admin');
      return;
    }

    fetchNotifications({ reset: true });

    const interval = setInterval(() => {
      fetchNotifications({ reset: true, silent: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, router]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.map((notification) => (
        notification.id === id
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      )));
    } catch (apiError) {
      notifyError(apiError.response?.data?.error || 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || now,
      })));
      notifySuccess('All notifications marked as read');
    } catch (apiError) {
      notifyError(apiError.response?.data?.error || 'Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (id) => {
    setDeletingId(id);
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
      setTotal((prev) => prev - 1);
      notifySuccess('Notification deleted');
    } catch (apiError) {
      notifyError(apiError.response?.data?.error || 'Failed to delete notification');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await notificationsApi.deleteAllNotifications();
      setNotifications([]);
      setTotal(0);
      setOffset(0);
      notifySuccess('All notifications deleted');
    } catch (apiError) {
      notifyError(apiError.response?.data?.error || 'Failed to delete all notifications');
    }
  };

  const requestDeleteAll = () => {
    confirmToast({
      title: `Delete all ${total} notifications?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete All',
      onConfirm: handleDeleteAll,
    });
  };

  const hasMore = notifications.length < total;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="WORKER" onLogout={handleLogout} />

      <div className="lg:ml-64">
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 mt-1">{unreadCount} unread of {total} total</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell role="WORKER" />
              <button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark All Read
              </button>
              <button
                onClick={requestDeleteAll}
                disabled={notifications.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-8 modern-enter">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
              <p className="text-xl font-semibold text-gray-900">No notifications yet</p>
              <p className="text-gray-500 mt-2">You are all caught up.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 ${notification.isRead ? 'border-gray-100' : 'border-blue-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_CLASS[notification.severity] || SEVERITY_CLASS.INFO}`}>
                          {notification.severity}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {TYPE_LABELS[notification.type] || 'Notification'}
                        </span>
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mt-2">{notification.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkRead(notification.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notification.id)}
                        disabled={deletingId === notification.id}
                        className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        {deletingId === notification.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => fetchNotifications({ reset: false, startOffset: offset })}
                disabled={isLoadingMore}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
