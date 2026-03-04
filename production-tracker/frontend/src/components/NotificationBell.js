'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import notificationsApi from '@/lib/notifications';
import { BellIcon } from '@/components/ui/bell';

const TYPE_LABELS = {
  STAGE_ASSIGNED: 'Assignment',
  STAGE_STATUS_CHANGED: 'Stage Update',
  LOW_STOCK: 'Low Stock',
  CHAT_MESSAGE: 'Chat Message',
};

export default function NotificationBell({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const bellRef = useRef(null);

  const notificationsPagePath = role === 'ADMIN' ? '/admin/notifications' : '/worker/notifications';

  const unreadInList = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const loadUnreadCount = async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Unread count error:', error);
    }
  };

  const loadRecentNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getNotifications({ limit: 8, offset: 0 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.notifications?.filter((n) => !n.isRead).length || 0);
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications((prev) => prev.map((notification) => (
        notification.id === notificationId
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || now,
      })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all read error:', error);
    }
  };

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRecentNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    if (unreadCount <= 0) return;

    bellRef.current?.startAnimation?.();
    const timeout = setTimeout(() => {
      bellRef.current?.stopAnimation?.();
    }, 650);

    return () => clearTimeout(timeout);
  }, [unreadCount]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => bellRef.current?.startAnimation?.()}
        onMouseLeave={() => bellRef.current?.stopAnimation?.()}
        className="relative flex items-center justify-center p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        aria-label="Notifications"
      >
        <BellIcon ref={bellRef} size={20} className="text-current pointer-events-none" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden flex flex-col sm:w-96 ">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Recent Notifications</h3>
            {unreadInList > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                  className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                    notification.isRead ? 'bg-white' : 'bg-indigo-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-600">
                      {TYPE_LABELS[notification.type] || 'Notification'}
                    </p>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{notification.title}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-gray-200">
            <Link
              href={notificationsPagePath}
              onClick={() => setIsOpen(false)}
              className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
