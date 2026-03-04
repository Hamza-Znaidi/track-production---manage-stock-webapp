'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';
import { notifyError } from '@/lib/toast';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

const STATUS_COLORS = {
  PENDING: '#6B7280',
  IN_PROGRESS: '#2563EB',
  COMPLETED: '#16A34A',
  CANCELLED: '#DC2626',
};

const CATEGORY_COLORS = {
  RAW_MATERIAL: '#7C3AED',
  COMPONENT: '#2563EB',
  FINISHED_PRODUCT: '#16A34A',
  TOOL: '#4B5563',
  CONSUMABLE: '#EA580C',
};

const STAGE_ORDER = ['SALES', 'CAD', 'CAM', 'STORE', 'CNC', 'ASSEMBLY', 'QUALITY', 'DELIVERY'];

function getWeekStartDate(dateInput) {
  const date = new Date(dateInput);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 modern-hover">
      <div className="mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

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
    const { workOrders, stockItems, reservations } = reportData;

    const workOrderStatusData = [
      { name: 'Pending', value: workOrders.filter((w) => w.status === 'PENDING').length, color: STATUS_COLORS.PENDING },
      { name: 'In Progress', value: workOrders.filter((w) => w.status === 'IN_PROGRESS').length, color: STATUS_COLORS.IN_PROGRESS },
      { name: 'Completed', value: workOrders.filter((w) => w.status === 'COMPLETED').length, color: STATUS_COLORS.COMPLETED },
      { name: 'Cancelled', value: workOrders.filter((w) => w.status === 'CANCELLED').length, color: STATUS_COLORS.CANCELLED },
    ].filter((item) => item.value > 0);

    const weeklyThroughputData = (() => {
      const weeks = [];
      const currentWeekStart = getWeekStartDate(new Date());

      for (let index = 7; index >= 0; index -= 1) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() - index * 7);
        weeks.push({
          key: date.toISOString().slice(0, 10),
          label: formatWeekLabel(date),
          created: 0,
          completed: 0,
        });
      }

      const weekByKey = new Map(weeks.map((week) => [week.key, week]));

      workOrders.forEach((workOrder) => {
        const createdKey = getWeekStartDate(workOrder.createdAt).toISOString().slice(0, 10);
        if (weekByKey.has(createdKey)) {
          weekByKey.get(createdKey).created += 1;
        }

        if (workOrder.status === 'COMPLETED') {
          const completedKey = getWeekStartDate(workOrder.updatedAt || workOrder.createdAt).toISOString().slice(0, 10);
          if (weekByKey.has(completedKey)) {
            weekByKey.get(completedKey).completed += 1;
          }
        }
      });

      return weeks;
    })();

    const stageBottleneckData = STAGE_ORDER.map((subRole) => {
      let pending = 0;
      let inProgress = 0;

      workOrders.forEach((workOrder) => {
        (workOrder.stages || []).forEach((stage) => {
          if (stage.subRole !== subRole) return;
          if (stage.status === 'PENDING') pending += 1;
          if (stage.status === 'IN_PROGRESS') inProgress += 1;
        });
      });

      return {
        stage: subRole,
        pending,
        inProgress,
        active: pending + inProgress,
      };
    });

    const workerLoadMap = new Map();
    workOrders.forEach((workOrder) => {
      (workOrder.stages || []).forEach((stage) => {
        if (!stage.assignedTo?.username) return;
        if (stage.status !== 'PENDING' && stage.status !== 'IN_PROGRESS') return;

        const key = stage.assignedTo.username;
        workerLoadMap.set(key, (workerLoadMap.get(key) || 0) + 1);
      });
    });

    const workerLoadData = [...workerLoadMap.entries()]
      .map(([worker, activeTasks]) => ({ worker, activeTasks }))
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 10);

    const categoryHealthMap = new Map();
    const categoryValueMap = new Map();

    stockItems.forEach((item) => {
      const category = item.category || 'OTHER';
      const currentHealth = categoryHealthMap.get(category) || { category, low: 0, healthy: 0 };

      if (item.isLowStock) currentHealth.low += 1;
      else currentHealth.healthy += 1;
      categoryHealthMap.set(category, currentHealth);

      const currentValue = categoryValueMap.get(category) || 0;
      const itemValue = (Number(item.quantity) || 0) * (Number(item.price) || 0);
      categoryValueMap.set(category, currentValue + itemValue);
    });

    const stockHealthByCategoryData = [...categoryHealthMap.values()]
      .sort((a, b) => (b.low + b.healthy) - (a.low + a.healthy));

    const inventoryValueByCategoryData = [...categoryValueMap.entries()]
      .map(([category, value]) => ({ category, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    const reservationStatusData = [
      { name: 'Reserved', value: reservations.filter((reservation) => reservation.status === 'RESERVED').length, color: '#2563EB' },
      { name: 'Consumed', value: reservations.filter((reservation) => reservation.status === 'CONSUMED').length, color: '#16A34A' },
      { name: 'Cancelled', value: reservations.filter((reservation) => reservation.status === 'CANCELLED').length, color: '#DC2626' },
    ].filter((item) => item.value > 0);

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
      weeklyThroughputData,
      stageBottleneckData,
      workerLoadData,
      stockHealthByCategoryData,
      inventoryValueByCategoryData,
      reservationStatusData,
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
              <p className="text-xs text-gray-500 uppercase font-medium">Work Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalWorkOrders}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.inProgressWorkOrders} in progress</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-xs text-gray-500 uppercase font-medium">Completion Rate</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.totalWorkOrders > 0
                  ? Math.round((stats.completedWorkOrders / stats.totalWorkOrders) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500 mt-2">{stats.completedWorkOrders} completed</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-xs text-gray-500 uppercase font-medium">Low Stock Items</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.lowStockItems}</p>
              <p className="text-xs text-gray-500 mt-2">of {stats.totalStockItems} total items</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-xs text-gray-500 uppercase font-medium">Active Reservations</p>
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
            <ChartCard title="Work Order Status" subtitle="Current status distribution">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.workOrderStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label
                  >
                    {chartData.workOrderStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Weekly Throughput" subtitle="Created vs completed (last 8 weeks)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.weeklyThroughputData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" stroke="#2563EB" strokeWidth={2} name="Created" />
                  <Line type="monotone" dataKey="completed" stroke="#16A34A" strokeWidth={2} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Stage Bottlenecks" subtitle="Pending and in-progress by department">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.stageBottleneckData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pending" fill="#6B7280" name="Pending" />
                  <Bar dataKey="inProgress" fill="#2563EB" name="In Progress" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Worker Load" subtitle="Active assigned stages (top 10)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.workerLoadData} layout="vertical" margin={{ left: 20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="worker" type="category" width={110} />
                  <Tooltip />
                  <Bar dataKey="activeTasks" fill="#4F46E5" name="Active Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Stock Health by Category" subtitle="Low stock vs healthy inventory">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.stockHealthByCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="healthy" stackId="stock" fill="#16A34A" name="Healthy" />
                  <Bar dataKey="low" stackId="stock" fill="#EA580C" name="Low Stock" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Inventory Value by Category" subtitle="Quantity × unit price">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.inventoryValueByCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}`} />
                  <Bar dataKey="value" name="Value">
                    {chartData.inventoryValueByCategoryData.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#4B5563'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Reservation Status" subtitle="Lifecycle distribution">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.reservationStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label
                  >
                    {chartData.reservationStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Clients" subtitle="Work orders count by client">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.topClientsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="client" interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#2563EB" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  );
}
