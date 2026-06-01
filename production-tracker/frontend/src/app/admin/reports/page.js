'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
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
  Sparkles,
  Loader2,
  FileText,
  FileDown,
  Lightbulb,
  ShieldAlert,
  Trophy,
  TrendingUp,
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
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

  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const toInputDate = (date) => date.toISOString().slice(0, 10);

    setReportStartDate(toInputDate(startDate));
    setReportEndDate(toInputDate(endDate));
  }, []);

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

  const resolveWorkerName = (worker) => worker?.username || worker?.name || worker?.worker || 'Unknown';

  const buildPdf = () => {
    if (!aiReport) return;

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 16;
    const headerHeight = 108;
    const sectionGap = 18;
    let cursorY = headerHeight + 28;

    const reportTitle = 'Production Insights Report';
    const generatedAtText = `Generated: ${new Date(aiReport.generatedAt).toLocaleString()}`;
    const rangeText = `Range: ${reportStartDate || 'N/A'} to ${reportEndDate || 'N/A'}`;

    const palette = {
      indigo: [79, 70, 229],
      indigoDark: [49, 46, 129],
      sky: [14, 165, 233],
      emerald: [16, 185, 129],
      amber: [245, 158, 11],
      rose: [244, 63, 94],
      slate: [15, 23, 42],
      soft: [248, 250, 252],
      border: [226, 232, 240],
      text: [15, 23, 42],
      muted: [100, 116, 139],
    };

    const setFill = (color) => pdf.setFillColor(color[0], color[1], color[2]);
    const setStroke = (color) => pdf.setDrawColor(color[0], color[1], color[2]);

    const addFooter = () => {
      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(...palette.muted);
        pdf.text(`Page ${page} of ${pageCount}`, margin, pageHeight - 24);
        pdf.text('KTS Production Tracker', pageWidth - margin - 120, pageHeight - 24);
      }
    };

    const drawHeader = () => {
      setFill(palette.indigo);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');
      setFill(palette.sky);
      pdf.circle(pageWidth - 70, 30, 26, 'F');
      setFill([255, 255, 255]);
      pdf.circle(pageWidth - 35, 76, 14, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.text(reportTitle, margin, 38);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(generatedAtText, margin, 58);
      pdf.text(rangeText, margin, 74);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AI-powered production analysis', margin, 92);
      pdf.setTextColor(...palette.text);
    };

    const newPage = () => {
      pdf.addPage();
      cursorY = headerHeight + 28;
      drawHeader();
    };

    const ensureSpace = (needed = 20) => {
      if (cursorY + needed > pageHeight - 44) {
        newPage();
      }
    };

    const writeTitle = (text, size = 18, accent = palette.indigo) => {
      const blockHeight = size + 18;
      ensureSpace(blockHeight);
      setFill([255, 255, 255]);
      setStroke(accent);
      pdf.roundedRect(margin, cursorY - 6, contentWidth, blockHeight, 8, 8, 'FD');
      setFill(accent);
      pdf.roundedRect(margin, cursorY - 6, 8, blockHeight, 8, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(size);
      pdf.setTextColor(...palette.text);
      pdf.text(text, margin + 18, cursorY + size - 2);
      cursorY += blockHeight + 10;
    };

    const writeParagraph = (text, options = {}) => {
      const fontSize = options.fontSize || 11;
      const style = options.bold ? 'bold' : 'normal';
      pdf.setFont('helvetica', style);
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(String(text || ''), contentWidth);
      ensureSpace(lines.length * lineHeight + 10);
      pdf.text(lines, margin, cursorY);
      cursorY += lines.length * lineHeight + 4;
    };

    const writeBullet = (text, color = palette.indigo) => {
      const lines = pdf.splitTextToSize(String(text || ''), contentWidth - 16);
      ensureSpace(lines.length * lineHeight + 10);
      setFill(color);
      pdf.circle(margin + 4, cursorY + 4, 2.5, 'F');
      pdf.setTextColor(...palette.text);
      pdf.text(lines, margin + 14, cursorY + 8);
      cursorY += lines.length * lineHeight + 4;
    };

    const writeCard = (x, y, width, height, label, value, accent) => {
      setFill([255, 255, 255]);
      setStroke(palette.border);
      pdf.roundedRect(x, y, width, height, 10, 10, 'FD');
      setFill(accent);
      pdf.roundedRect(x, y, 6, height, 10, 10, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.muted);
      pdf.text(label, x + 14, y + 20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(...palette.text);
      pdf.text(String(value), x + 14, y + 46);
    };

    drawHeader();

    const cardWidth = (contentWidth - 12) / 2;
    const cardHeight = 66;
    const cardY = cursorY;
    writeCard(margin, cardY, cardWidth, cardHeight, 'Total Notes', aiReport.stats?.totalNotes ?? 0, palette.indigo);
    writeCard(margin + cardWidth + 12, cardY, cardWidth, cardHeight, 'Workers', aiReport.stats?.totalWorkers ?? 0, palette.emerald);
    cursorY += cardHeight + sectionGap;

    const writeMetricStrip = () => {
      ensureSpace(72);
      const stripY = cursorY;
      setFill([245, 247, 255]);
      setStroke([226, 232, 240]);
      pdf.roundedRect(margin, stripY, contentWidth, 64, 10, 10, 'FD');

      const metrics = [
        { label: 'Completed Stages', value: aiReport.stats?.completedStages ?? 0, accent: palette.emerald },
        { label: 'Active Stages', value: aiReport.stats?.activeStages ?? 0, accent: palette.sky },
        { label: 'Insights', value: (aiReport.insights || []).length, accent: palette.amber },
        { label: 'Issues', value: (aiReport.qualityIssues || []).length, accent: palette.rose },
      ];

      const metricWidth = contentWidth / 4;
      metrics.forEach((metric, index) => {
        const x = margin + index * metricWidth;
        setFill(metric.accent);
        pdf.circle(x + 16, stripY + 20, 7, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(...palette.text);
        pdf.text(String(metric.value), x + 30, stripY + 18);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(...palette.muted);
        pdf.text(metric.label, x + 30, stripY + 34);
      });

      cursorY += 84;
    };

    writeMetricStrip();

    writeTitle('Executive Summary', 15, palette.indigo);
    setFill([248, 250, 252]);
    setStroke(palette.border);
    pdf.roundedRect(margin, cursorY - 4, contentWidth, 72, 10, 10, 'FD');
    writeParagraph(aiReport.summary || 'No summary available.', { fontSize: 11 });
    cursorY += 8;

    writeTitle('Key Insights', 15, palette.amber);
    (aiReport.insights || []).forEach((item) => writeBullet(item, palette.amber));

    writeTitle('Recommendations', 15, palette.emerald);
    (aiReport.recommendations || []).forEach((item) => writeBullet(item, palette.emerald));

    writeTitle('Quality Issues From Notes', 15, palette.rose);
    (aiReport.qualityIssues || []).forEach((item, index) => {
      if (typeof item === 'string') {
        writeBullet(item, palette.rose);
        return;
      }

      ensureSpace(54);
      setFill([255, 247, 248]);
      setStroke([251, 191, 207]);
      pdf.roundedRect(margin, cursorY - 4, contentWidth, 44, 8, 8, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.text);
      pdf.text(`${item.workOrderNumber || 'Unknown'} · ${item.stage || 'Unknown stage'} · ${item.worker || 'Unknown worker'}`, margin + 12, cursorY + 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.muted);
      pdf.text(pdf.splitTextToSize(item.content || item.description || '', contentWidth - 24), margin + 12, cursorY + 26);
      cursorY += 52;
    });

    writeTitle('Worker Performance', 15, palette.sky);
    (aiReport.workerPerformance || []).slice(0, 10).forEach((worker, index) => {
      const name = resolveWorkerName(worker);
      ensureSpace(42);
      const rowHeight = 34;
      setFill(index % 2 === 0 ? [248, 250, 252] : [255, 255, 255]);
      setStroke(palette.border);
      pdf.roundedRect(margin, cursorY - 2, contentWidth, rowHeight, 8, 8, 'FD');
      setFill(worker.efficiencyScore >= 70 ? palette.emerald : worker.efficiencyScore >= 40 ? palette.amber : palette.rose);
      pdf.circle(margin + 10, cursorY + 14, 5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.text);
      pdf.text(`#${index + 1} ${name}`, margin + 24, cursorY + 12);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...palette.muted);
      pdf.text(`Score ${worker.efficiencyScore ?? worker.score ?? 0}  |  Completed ${worker.completedStages ?? 0}  |  Assigned ${worker.assignedStages ?? 0}  |  Notes ${worker.notesAuthored ?? 0}`, margin + 24, cursorY + 24);
      cursorY += rowHeight + 8;
    });

    addFooter();
    pdf.save(`AI_Report_${new Date(aiReport.generatedAt).toISOString().slice(0, 10)}.pdf`);
  };

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      setReportError('');

      const payload = reportStartDate && reportEndDate
        ? { startDate: reportStartDate, endDate: reportEndDate }
        : { days: 7 };

      const response = await api.post('/reports/generate', payload);
      setAiReport(response.data.report);
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to generate AI report';
      setReportError(message);
      notifyError(message);
    } finally {
      setIsGeneratingReport(false);
    }
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
            <div className="flex flex-col items-end gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Start Date
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(event) => setReportStartDate(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  End Date
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(event) => setReportEndDate(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
                  />
                </label>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{isGeneratingReport ? 'Generating...' : 'Generate AI Report'}</span>
              </button>
              <NotificationBell role="ADMIN" />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6 modern-enter">
          {reportError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {reportError}
            </div>
          )}

          {aiReport && (
            <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Report
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Production Insights
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Generated {new Date(aiReport.generatedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={buildPdf}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    Executive Summary
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700 whitespace-pre-wrap">
                    {aiReport.summary || 'No summary returned by the AI model.'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-green-600" />
                    Key Stats
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-gray-500 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-gray-400" />Total Notes</p>
                      <p className="mt-1 font-bold text-gray-900">{aiReport.stats?.totalNotes ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-gray-500 flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-green-500" />Completed Stages</p>
                      <p className="mt-1 font-bold text-gray-900">{aiReport.stats?.completedStages ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-gray-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-blue-500" />Active Stages</p>
                      <p className="mt-1 font-bold text-gray-900">{aiReport.stats?.activeStages ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-gray-500 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-violet-500" />Workers</p>
                      <p className="mt-1 font-bold text-gray-900">{aiReport.stats?.totalWorkers ?? 0}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Insights
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {(aiReport.insights || []).slice(0, 5).map((item, index) => (
                      <li key={`${item}-${index}`} className="rounded-lg bg-white px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500" />
                    Recommendations
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {(aiReport.recommendations || []).slice(0, 5).map((item, index) => (
                      <li key={`${item}-${index}`} className="rounded-lg bg-white px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    Quality Issues From Notes
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {(aiReport.qualityIssues || []).slice(0, 6).map((item, index) => (
                      <li key={item.id || `${item}-${index}`} className="rounded-lg bg-white px-3 py-2">
                        {typeof item === 'string' ? (
                          <p className="text-gray-700">{item}</p>
                        ) : (
                          <>
                            <span className="font-medium text-gray-900">{item.workOrderNumber || 'Unknown work order'}</span>
                            {' '}
                            <span className="text-gray-500">({item.stage || 'Unknown stage'} - {item.worker || 'Unknown worker'})</span>
                            <p className="mt-1 text-gray-700">{item.content || item.description || ''}</p>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    Worker Performance
                  </h3>
                  <div className="mt-3 space-y-2">
                    {(aiReport.workerPerformance || []).slice(0, 5).map((worker, index) => (
                      <div key={worker.userId || worker.username || worker.name || index} className="rounded-lg bg-white px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900">#{index + 1} {resolveWorkerName(worker)}</span>
                          <span className="text-indigo-600 font-semibold">{worker.efficiencyScore ?? worker.score ?? 0}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Completed: {worker.completedStages ?? 0} | Assigned: {worker.assignedStages ?? 0} | Notes: {worker.notesAuthored ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
