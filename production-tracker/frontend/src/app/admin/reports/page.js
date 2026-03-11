'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';
import { notifyError } from '@/lib/toast';
import {
  ClipboardList,
  BadgeCheck,
  AlertTriangle,
  CalendarClock,
  PieChart as PieChartIcon,
  Users,
  Boxes,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const STATUS_COLORS = {
  PENDING: '#6B7280',
  IN_PROGRESS: '#2563EB',
  COMPLETED: '#16A34A',
  CANCELLED: '#DC2626',
};

function CustomChartTooltip({ active, payload, label, labelPrefix, valueFormatter }) {
  if (!active || !payload || payload.length === 0) return null;

  const items = payload.filter((item) => Number(item.value) !== 0);
  if (items.length === 0) return null;

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg shadow-xl px-3 py-2 min-w-44 backdrop-blur-sm">
      <p className="text-xs font-semibold text-gray-900 mb-2">
        <span className="text-slate-200">{labelPrefix ? `${labelPrefix}: ${label}` : label}</span>
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name || item.dataKey}</span>
            </div>
            <span className="font-semibold text-white">
              {valueFormatter ? valueFormatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="bg-gradient-to-b from-white to-slate-50 rounded-2xl shadow-sm border border-gray-100 p-5 modern-hover dark:from-gray-800 dark:to-gray-900 dark:border-gray-700 dark:text-white">
      <div className="mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 dark:text-white">
          {Icon && <Icon className="w-4 h-4 text-gray-600 dark:text-white" />}
          <span>{title}</span>
        </h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1 dark:text-white">{subtitle}</p>}
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

const shortenLabel = (value) => {
  if (!value) return value;
  return value.length > 16 ? `${value.slice(0, 16)}...` : value;
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkOrders: 0,
    completedWorkOrders: 0,
    inProgressWorkOrders: 0,
    pendingWorkOrders: 0,
    totalStockItems: 0,
    lowStockItems: 0,
    totalReservations: 0,
    activeReservations: 0,
    totalUsers: 0,
    workers: 0,
  });
  const [reportData, setReportData] = useState({
    workOrders: [],
    stockItems: [],
    reservations: [],
    users: [],
  });

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

    fetchReportData();
  }, [router]);

  const fetchReportData = async () => {
    try {
      const [workOrdersRes, stockRes, reservationsRes, usersRes] = await Promise.all([
        api.get('/workorders'),
        api.get('/stock'),
        api.get('/stock/reservations'),
        api.get('/auth/users'),
      ]);

      const workOrders = workOrdersRes.data.workOrders || [];
      const stockItems = stockRes.data.stockItems || [];
      const reservations = reservationsRes.data.reservations || [];
      const users = usersRes.data.users || [];

      const completedWorkOrders = workOrders.filter((w) => w.status === 'COMPLETED').length;
      const inProgressWorkOrders = workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
      const pendingWorkOrders = workOrders.filter((w) => w.status === 'PENDING').length;
      const lowStockItems = stockItems.filter((s) => s.isLowStock).length;
      const activeReservations = reservations.filter((r) => r.status === 'RESERVED').length;
      const workers = users.filter((u) => u.role === 'WORKER').length;

      setReportData({
        workOrders,
        stockItems,
        reservations,
        users,
      });

      setStats({
        totalWorkOrders: workOrders.length,
        completedWorkOrders,
        inProgressWorkOrders,
        pendingWorkOrders,
        totalStockItems: stockItems.length,
        lowStockItems,
        totalReservations: reservations.length,
        activeReservations,
        totalUsers: users.length,
        workers,
      });
    } catch (err) {
      notifyError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const chartData = useMemo(() => {
    const { workOrders, stockItems } = reportData;

    const workOrderStatusData = [
      {
        name: 'Pending',
        value: workOrders.filter((workOrder) => (workOrder.status || 'PENDING') === 'PENDING').length,
        color: STATUS_COLORS.PENDING,
      },
      {
        name: 'In Progress',
        value: workOrders.filter((workOrder) => workOrder.status === 'IN_PROGRESS').length,
        color: STATUS_COLORS.IN_PROGRESS,
      },
      {
        name: 'Completed',
        value: workOrders.filter((workOrder) => workOrder.status === 'COMPLETED').length,
        color: STATUS_COLORS.COMPLETED,
      },
      {
        name: 'Cancelled',
        value: workOrders.filter((workOrder) => workOrder.status === 'CANCELLED').length,
        color: STATUS_COLORS.CANCELLED,
      },
    ].filter((item) => item.value > 0);

    const stageWorkerMap = new Map();
    workOrders.forEach((workOrder) => {
      (workOrder.stages || []).forEach((stage) => {
        if (stage.status !== 'PENDING' && stage.status !== 'IN_PROGRESS') return;

        const worker = stage.assignedTo?.username || 'Unassigned';
        const subRole = stage.subRole || 'General';
        const key = `${worker}__${subRole}`;

        if (!stageWorkerMap.has(key)) {
          stageWorkerMap.set(key, {
            worker,
            subRole,
            workerSubRole: `${worker} (${subRole})`,
            pending: 0,
            inProgress: 0,
            active: 0,
          });
        }

        const item = stageWorkerMap.get(key);
        if (stage.status === 'PENDING') item.pending += 1;
        if (stage.status === 'IN_PROGRESS') item.inProgress += 1;
        item.active += 1;
      });
    });

    const stageBottleneckData = [...stageWorkerMap.values()]
      .sort((a, b) => b.active - a.active)
      .slice(0, 12);

    const stockHealthByItemData = stockItems
      .map((item) => {
        const quantity = Number(item.quantity) || 0;
        const threshold = Number(item.minQuantity) || 0;
        return {
          item: item.name || `Item-${item.id}`,
          healthDelta: quantity - threshold,
        };
      })
      .sort((a, b) => a.healthDelta - b.healthDelta || a.item.localeCompare(b.item));

    const topClientsData = (() => {
      const map = new Map();
      workOrders.forEach((workOrder) => {
        const client = workOrder.client || 'Unknown';
        map.set(client, (map.get(client) || 0) + 1);
      });

      return [...map.entries()]
        .map(([client, orders]) => ({ client, orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 8);
    })();

    return {
      workOrderStatusData,
      stageBottleneckData,
      stockHealthByItemData,
      topClientsData,
    };
  }, [reportData]);

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
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-1">
                Snapshot overview for production, stock, and team activity.
              </p>
            </div>
            <NotificationBell role="ADMIN" />
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6 modern-enter">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase font-medium">Work Orders</p>
                <ClipboardList className="w-4 h-4 text-gray-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalWorkOrders}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.inProgressWorkOrders} in progress</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase font-medium">Completion Rate</p>
                <BadgeCheck className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.totalWorkOrders > 0
                  ? Math.round((stats.completedWorkOrders / stats.totalWorkOrders) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500 mt-2">{stats.completedWorkOrders} completed</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase font-medium">Low Stock Items</p>
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.lowStockItems}</p>
              <p className="text-xs text-gray-500 mt-2">of {stats.totalStockItems} total items</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase font-medium">Active Reservations</p>
                <CalendarClock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.activeReservations}</p>
              <p className="text-xs text-gray-500 mt-2">of {stats.totalReservations} total reservations</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover">
            <h2 className="font-bold text-gray-900 mb-4">Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-gray-600">Pending Work Orders</p>
                <p className="text-xl font-semibold text-gray-900 mt-1">{stats.pendingWorkOrders}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-gray-600">Team Members</p>
                <p className="text-xl font-semibold text-gray-900 mt-1">
                  {stats.totalUsers} users ({stats.workers} workers)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Work Order Status" subtitle="Current status distribution" icon={PieChartIcon}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.22" />
                    </filter>
                  </defs>
                  <Pie
                    data={chartData.workOrderStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    label
                    style={{ filter: 'url(#pieShadow)' }}
                  >
                    {chartData.workOrderStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip labelPrefix="Status" />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Stage Bottlenecks" subtitle="Pending and in-progress by worker and sub-role" icon={Users} >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.stageBottleneckData} layout="vertical" margin={{ left: 20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="workerSubRole" type="category" width={170} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={shortenLabel} />
                  <Tooltip content={<CustomChartTooltip labelPrefix="Worker" />} />
                  <Legend />
                  <Bar dataKey="pending" fill="#64748b" name="Pending" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="inProgress" fill="#2563EB" name="In Progress" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Stock Health" subtitle="Stock minus threshold by item (unit baseline = 0)" icon={Boxes}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.stockHealthByItemData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="item" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={shortenLabel} />
                  <YAxis
                    allowDecimals={false}
                    domain={[(dataMin) => Math.min(dataMin, -5), (dataMax) => Math.max(dataMax, 5)]}
                    tickFormatter={(value) => `${value}`}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label="0" />
                  <Tooltip content={<CustomChartTooltip labelPrefix="Item" valueFormatter={(value) => `${value} units`} />} />
                  <Legend />
                  <Bar dataKey="healthDelta" name="Stock vs Threshold" minPointSize={4} radius={[6, 6, 0, 0]}>
                    {chartData.stockHealthByItemData.map((entry) => (
                      <Cell key={entry.item} fill={entry.healthDelta < 0 ? '#EA580C' : '#2563EB'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Clients" subtitle="Work orders count by client" icon={Building2}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.topClientsData}>
                  <defs>
                    <linearGradient id="clientBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="client" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={shortenLabel} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomChartTooltip labelPrefix="Client" />} />
                  <Bar dataKey="orders" fill="url(#clientBarGradient)" name="Orders" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}
