'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BriefcaseBusiness,
  PencilRuler,
  MonitorCog,
  Store,
  Cog,
  Wrench,
  Search,
  Truck,
  ClipboardList,
  Warehouse,
  Bell,
  FileText,
  Zap,
  CircleCheckBig,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';

const SUB_ROLE_CONFIG = {
  SALES: {
    label: 'Sales',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <BriefcaseBusiness className="text-blue-600" />,
    description: 'Handles sales and customer relations',
  },
  CAD: {
    label: 'CAD',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    icon: <PencilRuler className="text-purple-600" />,
    description: 'Creates technical CAD designs and drawings',
  },
  CAM: {
    label: 'CAM',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <MonitorCog className="text-cyan-600" />,
    description: 'Operates CAM software and programs machines',
  },
  STORE: {
    label: 'Store',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: <Store className="text-orange-600" />,
    description: 'Manages storage and raw materials',
  },
  CNC: {
    label: 'CNC',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    icon: <Cog className=" text-red-600" />,
    description: 'Operates CNC machines on the production floor',
  },
  ASSEMBLY: {
    label: 'Assembly',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <Wrench className="text-amber-600" />,
    description: 'Assembles parts and products on the line',
  },
  QUALITY: {
    label: 'Quality',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <Search className=" text-green-600" />,
    description: 'Inspects and ensures product quality standards',
  },
  DELIVERY: {
    label: 'Delivery',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <Truck className=" text-indigo-600" />,
    description: 'Manages shipping and product delivery',
  },
};

export default function WorkerDashboard() {
  const router = useRouter();
  const [user] = useState(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAssignedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [inProgressStages, setInProgressStages] = useState([]);

  async function fetchDashboardData() {
    try {
      const [activeResponse, completedResponse] = await Promise.all([
        api.get('/stages/my-tasks'),
        api.get('/stages/my-completed'),
      ]);

      const activeTasks = activeResponse.data.stages || [];
      const completedStages = (completedResponse.data.stages || []).filter(
        (stage) => stage.status === 'COMPLETED'
      );

      // Calculate statistics
      const totalAssignedTasks = activeTasks.length;
      const pendingTasks = activeTasks.filter(s => s.status === 'PENDING').length;
      const inProgressTasks = activeTasks.filter(s => s.status === 'IN_PROGRESS').length;
      const inProgressTasksList = activeTasks.filter(s => s.status === 'IN_PROGRESS');

      // Completed tasks statistics
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const completedToday = completedStages.filter(s => {
        const completedDate = new Date(s.completedAt);
        return completedDate >= todayStart;
      }).length;

      const completedThisWeek = completedStages.filter(s => {
        const completedDate = new Date(s.completedAt);
        return completedDate >= weekStart;
      }).length;

      const completedThisMonth = completedStages.filter(s => {
        const completedDate = new Date(s.completedAt);
        return completedDate >= monthStart;
      }).length;

      setStats({
        totalAssignedTasks,
        pendingTasks,
        inProgressTasks,
        completedToday,
        completedThisWeek,
        completedThisMonth,
      });

      // Get recent completed tasks (last 5)
      const recentCompleted = completedStages
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5);

      setRecentTasks(recentCompleted);
      setInProgressStages(inProgressTasksList.slice(0, 6));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setIsLoading(false);
    }
  }

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
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const subRoles = user?.subRoles || [];
  const completionRate = stats.completedThisWeek > 0 
    ? Math.round((stats.completedThisWeek / (stats.completedThisWeek + stats.totalAssignedTasks)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="WORKER" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                My Dashboard
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-gray-600">
                  Welcome, <span className="font-semibold text-blue-600">{user?.username}</span>
                </p>
                {/* Sub-role badges in header */}
                <div className="flex flex-wrap gap-2">
                  {subRoles.map((sr) => {
                    const config = SUB_ROLE_CONFIG[sr];
                    if (!config) return null;
                    return (
                      <span
                        key={sr}
                        className={`inline-flex items-center space-x-1 px-3 py-1 text-xs font-semibold rounded-full border bg-gray-100 text-gray-800 border-gray-200 `}
                      >
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <NotificationBell role="WORKER" />
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-8 modern-enter">
          {/* Top Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Active Tasks */}
            <div
              onClick={() => router.push('/worker/tasks')}
              className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition cursor-pointer modern-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Tasks</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalAssignedTasks}</p>
                  <p className="text-xs text-blue-600 mt-2">View all</p>
                </div>
                <div className="bg-blue-50 rounded-full p-3">
                  <FileText className="w-7 h-7 text-blue-600" />
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition modern-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.inProgressTasks}</p>
                  <p className="text-xs text-gray-500 mt-2">{stats.pendingTasks} pending</p>
                </div>
                <div className="bg-yellow-50 rounded-full p-3">
                  <Zap className="w-7 h-7 text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Completed Today */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition modern-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Today</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedToday}</p>
                  <p className="text-xs text-gray-500 mt-2">{stats.completedThisWeek} this week</p>
                </div>
                <div className="bg-green-50 rounded-full p-3">
                  <CircleCheckBig className="w-7 h-7 text-green-600" />
                </div>
              </div>
            </div>

            {/* This Month */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition modern-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">This Month</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{stats.completedThisMonth}</p>
                  <p className="text-xs text-gray-500 mt-2">Completed</p>
                </div>
                <div className="bg-purple-50 rounded-full p-3">
                  <BarChart3 className="w-7 h-7 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tasks In Progress */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
              <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center space-x-2">
                
                <span>Tasks in Progress</span>
              </h2>

              {inProgressStages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="mx-auto mb-3 size-8 text-gray-400" />
                  

                  <p className="mt-3 text-sm">No tasks are in progress right now.</p>
                  <p className="text-xs mt-1">Start a pending task to see it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inProgressStages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => router.push('/worker/tasks')}
                      className="w-full text-left rounded-lg border border-yellow-200 bg-yellow-50/60 p-4 hover:bg-yellow-50 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {stage.workOrder?.workOrderNumber || 'Task'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {stage.workOrder?.project || stage.workOrder?.item || 'No project details'}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2.5 py-1 text-xs font-medium">
                          {stage.subRole || 'General'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
              <h2 className="text-xl font-bold text-gray-900 mb-5">Performance</h2>
              
              {/* Completion Rate Circle */}
              <div className="flex justify-center mb-6">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - completionRate / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{completionRate}%</span>
                    <span className="text-xs text-gray-500">Efficiency</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">This Week</span>
                  <span className="font-bold text-green-600">{stats.completedThisWeek} completed</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-bold text-purple-600">{stats.completedThisMonth} completed</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Active</span>
                  <span className="font-bold text-blue-600">{stats.totalAssignedTasks} tasks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Recently Completed</h2>
              <button
                onClick={() => router.push('/worker/tasks')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition modern-pulse"
              >
                <span className="inline-flex items-center gap-1">
                  View all tasks <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>

            {recentTasks.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="mx-auto mb-3 size-8 text-gray-400" />
                <p className="text-gray-500 text-sm">No completed tasks yet</p>
                <p className="text-xs text-gray-400 mt-1">Completed tasks will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => {
                  const config = SUB_ROLE_CONFIG[task.subRole];
                  return (
                    <div
                      key={task.id}
                      className="flex items-center space-x-4 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0"
                    >
                      <div className="bg-green-100 rounded-full p-2 flex-shrink-0">
                        <CircleCheckBig className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{config?.icon}</span>
                          <p className="text-sm font-semibold text-gray-900">{task.subRole}</p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-600 font-mono">
                            {task.workOrder?.workOrderNumber}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {task.workOrder?.client} — {task.workOrder?.project}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatTimeAgo(task.completedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
            <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/worker/tasks')}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-center modern-hover "
              >
                <ClipboardList className="mx-auto mb-3 size-8 text-blue-400" />
                <p className="font-semibold text-gray-900 text-sm">My Tasks</p>
                <p className="text-xs text-gray-500 mt-0.5">View assigned work</p>
              </button>

              <button
                onClick={() => router.push('/worker/stock')}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all duration-200 text-center modern-hover "
              >
                <Warehouse className="mx-auto mb-3 size-8 text-orange-400" />
                <p className="font-semibold text-gray-900 text-sm">View Stock</p>
                <p className="text-xs text-gray-500 mt-0.5">Check inventory</p>
              </button>

              <button
                onClick={() => router.push('/worker/notifications')}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 text-center modern-hover "
              >
                <Bell className="mx-auto mb-3 size-8 text-purple-400" />
                <p className="font-semibold text-gray-900 text-sm">View Notifications</p>
                <p className="text-xs text-gray-500 mt-0.5">See recent updates</p>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}