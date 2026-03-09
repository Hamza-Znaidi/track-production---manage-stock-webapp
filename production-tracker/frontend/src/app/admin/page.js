'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlusCorner , Warehouse, BarChart,UserCog,ClipboardX } from 'lucide-react';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'text-gray-600',  bg: 'bg-gray-100'  },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-600',  bg: 'bg-blue-100'  },
  COMPLETED:   { label: 'Completed',   color: 'text-green-600', bg: 'bg-green-100' },
  CANCELLED:   { label: 'Cancelled',   color: 'text-red-600',   bg: 'bg-red-100'   },
};

export default function AdminDashboard() {
  const router = useRouter();
  const [user] = useState(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalWorkers: 0,
    totalWorkOrders: 0,
    pendingWorkOrders: 0,
    inProgressWorkOrders: 0,
    completedWorkOrders: 0,
  });
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  const fetchDashboardData = async () => {
    try {
      // Fetch users and work orders in parallel
      const [usersResponse, workOrdersResponse] = await Promise.all([
        api.get('/auth/users'),
        api.get('/workorders'),
      ]);

      const users = usersResponse.data.users;
      const workOrders = workOrdersResponse.data.workOrders;

      // User stats
      const totalUsers = users.length;
      const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
      const totalWorkers = users.filter(u => u.role === 'WORKER').length;

      // Work order stats
      const totalWorkOrders = workOrders.length;
      const pendingWorkOrders = workOrders.filter(w => w.status === 'PENDING').length;
      const inProgressWorkOrders = workOrders.filter(w => w.status === 'IN_PROGRESS').length;
      const completedWorkOrders = workOrders.filter(w => w.status === 'COMPLETED').length;

      setStats({
        totalUsers, totalAdmins, totalWorkers,
        totalWorkOrders, pendingWorkOrders,
        inProgressWorkOrders, completedWorkOrders,
      });

      // Recent work orders (last 5)
      setRecentWorkOrders(workOrders.slice(0, 5));

      // Recent users (last 3)
      const sortedUsers = [...users]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);
      setRecentUsers(sortedUsers);

      setIsLoading(false);
    } catch (error) {
      console.error('Dashboard error:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/');
      return;
    }
    const currentUser = authService.getCurrentUser();
    if (currentUser.role !== 'ADMIN') {
      router.push('/worker');
      return;
    }
    Promise.resolve().then(() => fetchDashboardData());
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
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
      <Sidebar role="ADMIN" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back,{' '}
                <span className="font-semibold text-indigo-600">{user?.username}</span>
              </p>
            </div>
            <NotificationBell role="ADMIN" />
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-8 modern-enter">

          {/* ── Top Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Work Orders */}
            <div
              onClick={() => router.push('/admin/workorders')}
              className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition cursor-pointer modern-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Work Orders</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalWorkOrders}</p>
                  <p className="text-xs text-indigo-600 mt-2">View all →</p>
                </div>
                <div className="bg-indigo-50 rounded-full p-3">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition modern-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{stats.inProgressWorkOrders}</p>
                  <p className="text-xs text-gray-500 mt-2">{stats.pendingWorkOrders} pending</p>
                </div>
                <div className="bg-blue-50 rounded-full p-3">
                  <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition modern-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedWorkOrders}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.totalWorkOrders > 0
                      ? `${Math.round((stats.completedWorkOrders / stats.totalWorkOrders) * 100)}% rate`
                      : '0% rate'}
                  </p>
                </div>
                <div className="bg-green-50 rounded-full p-3">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Users */}
            <div
              onClick={() => router.push('/admin/workers')}
              className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition cursor-pointer modern-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.totalAdmins} admins · {stats.totalWorkers} workers
                  </p>
                </div>
                <div className="bg-purple-50 rounded-full p-3">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* ── Middle Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Recent Work Orders */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden modern-hover">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">Recent Work Orders</h2>
                <button
                  onClick={() => router.push('/admin/workorders')}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition modern-pulse"
                >
                  View all →
                </button>
              </div>

              {recentWorkOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-3"><ClipboardX className='w-14 h-14 mb-4 mt-20 mx-auto '/> </div>
                  <p className="text-gray-500 text-sm">No work orders yet</p>
                  <button
                    onClick={() => router.push('/admin/workorders/new')}
                    className="mt-3 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    Create your first work order →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentWorkOrders.map((wo) => {
                    const statusConf = STATUS_CONFIG[wo.status] || STATUS_CONFIG.PENDING;
                    return (
                      <div
                        key={wo.id}
                        onClick={() => router.push(`/admin/workorders/${wo.id}`)}
                        className="px-6 py-4 hover:bg-gray-50 transition cursor-pointer modern-hover"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="bg-indigo-100 rounded-lg p-2 flex-shrink-0">
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="font-mono font-semibold text-indigo-600 text-sm">
                                  {wo.workOrderNumber}
                                </p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
                                  {statusConf.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {wo.client} — {wo.project}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                            {/* Progress bar */}
                            <div className="hidden sm:flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full"
                                  style={{ width: `${wo.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8">{wo.progress}%</span>
                            </div>
                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                              {wo.deliveryWeek}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Work Order Status Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
                <h2 className="font-bold text-gray-900 mb-4">Status Breakdown</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Pending',     value: stats.pendingWorkOrders,     color: 'bg-gray-400'  },
                    { label: 'In Progress', value: stats.inProgressWorkOrders,  color: 'bg-blue-500'  },
                    { label: 'Completed',   value: stats.completedWorkOrders,   color: 'bg-green-500' },
                    { label: 'Cancelled',   value: stats.totalWorkOrders - stats.pendingWorkOrders - stats.inProgressWorkOrders - stats.completedWorkOrders, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-semibold text-gray-900">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`${item.color} h-2 rounded-full transition-all`}
                          style={{
                            width: stats.totalWorkOrders > 0
                              ? `${(item.value / stats.totalWorkOrders) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Users */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900">Recent Users</h2>
                  <button
                    onClick={() => router.push('/admin/workers')}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.username}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(u.createdAt)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
            <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'New Work Order',
                  desc: 'Create work order',
                  icon: <FilePlusCorner className='text-blue-600' size={24} />,
                  color: 'hover:border-indigo-500 hover:bg-indigo-50',
                  action: () => router.push('/admin/workorders/new'),
                },
                {
                  label: 'manage stock',
                  desc: 'Manage inventory',
                  icon:<Warehouse className='text-green-600' size={24} />,
                  color: 'hover:border-green-500 hover:bg-green-50',
                  action: () => router.push('/admin/stock'),
                },
                {
                  label: 'View All Orders',
                  desc: 'Track production',
                  icon: <BarChart className='text-blue-600' size={24} />,
                  color: 'hover:border-blue-500 hover:bg-blue-50',
                  action: () => router.push('/admin/workorders'),
                },
                {
                  label: 'Manage Workers',
                  desc: 'Edit permissions',
                  icon: <UserCog  className='text-purple-600' size={24} />,
                  color: 'hover:border-purple-500 hover:bg-purple-50',
                  action: () => router.push('/admin/workers'),
                },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className={`flex flex-col items-center p-4 border-2 border-gray-200 rounded-xl transition-all duration-200 text-center modern-hover  ${action.color}`}
                >
                  <span className="text-3xl mb-2">{action.icon}</span>
                  <p className="font-semibold text-gray-900 text-sm">{action.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}