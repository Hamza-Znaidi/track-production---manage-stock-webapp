import api from './axios';

const notificationsApi = {
  getNotifications: async ({ limit = 20, offset = 0 } = {}) => {
    const response = await api.get('/notifications', {
      params: { limit, offset },
    });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data.unreadCount || 0;
  },

  markAsRead: async (notificationId) => {
    await api.patch(`/notifications/${notificationId}/read`);
  },

  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  deleteAllNotifications: async () => {
    const response = await api.delete('/notifications');
    return response.data;
  },
};

export default notificationsApi;
