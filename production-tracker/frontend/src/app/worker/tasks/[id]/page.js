'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';
import { notifyError } from '@/lib/toast';
import {
  Pause,
  Zap,
  CircleCheckBig,
  SkipForward,
  CircleX,
  BriefcaseBusiness,
  PencilRuler,
  MonitorCog,
  Store,
  Cog,
  Wrench,
  Search,
  Truck,
  ArrowLeft,
  ClipboardList,
  Factory,
  UserRound,
  StickyNote,
} from 'lucide-react';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
    icon: <Pause className="w-4 h-4" />,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    icon: <Zap className="w-4 h-4" />,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    icon: <CircleCheckBig className="w-4 h-4" />,
  },
  SKIPPED: {
    label: 'Skipped',
    color: 'bg-yellow-100 text-yellow-700',
    dot: 'bg-yellow-500',
    icon: <SkipForward className="w-4 h-4" />,
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    icon: <CircleX className="w-4 h-4" />,
  },
};

const STAGE_ORDER = [
  'SALES',
  'CAD',
  'CAM',
  'STORE',
  'CNC',
  'ASSEMBLY',
  'QUALITY',
  'DELIVERY',
];

const STAGE_ICONS = {
  SALES: <BriefcaseBusiness className="w-6 h-6 text-blue-600" />,
  CAD: <PencilRuler className="w-6 h-6 text-purple-600" />,
  CAM: <MonitorCog className="w-6 h-6 text-cyan-600" />,
  STORE: <Store className="w-6 h-6 text-orange-600" />,
  CNC: <Cog className="w-6 h-6 text-red-600" />,
  ASSEMBLY: <Wrench className="w-6 h-6 text-amber-600" />,
  QUALITY: <Search className="w-6 h-6 text-green-600" />,
  DELIVERY: <Truck className="w-6 h-6 text-indigo-600" />,
};

export default function WorkerTaskDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const stageId = Number(params?.id);

  const [workOrder, setWorkOrder] = useState(null);
  const [currentStageId, setCurrentStageId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

    if (!stageId || Number.isNaN(stageId)) {
      notifyError('Invalid task ID');
      setIsLoading(false);
      return;
    }

    fetchWorkOrderDetails(stageId);
  }, [router, stageId]);

  const fetchWorkOrderDetails = async (selectedStageId) => {
    try {
      setIsLoading(true);
      const tasksResponse = await api.get('/stages/my-tasks');
      const selectedTask = (tasksResponse.data.stages || []).find(
        (stage) => stage.id === selectedStageId
      );

      if (!selectedTask) {
        notifyError('Task not found');
        setWorkOrder(null);
        setIsLoading(false);
        return;
      }

      const workOrderResponse = await api.get(`/workorders/${selectedTask.workOrder.id}`);
      setWorkOrder(workOrderResponse.data.workOrder);
      setCurrentStageId(selectedStageId);
    } catch (fetchError) {
      notifyError('Failed to load work order details');
      setWorkOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const getSortedStages = (stages) => {
    return [...stages].sort(
      (a, b) => STAGE_ORDER.indexOf(a.subRole) - STAGE_ORDER.indexOf(b.subRole)
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">Work Order Not Found</p>
          <button
            onClick={() => router.push('/worker/tasks')}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg"
          >
            Back to My Tasks
          </button>
        </div>
      </div>
    );
  }

  const sortedStages = getSortedStages(workOrder.stages);
  const woStatus = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="WORKER" onLogout={handleLogout} />

      <div className="lg:ml-64">
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/worker/tasks')}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900 font-mono">
                      {workOrder.workOrderNumber}
                    </h1>
                    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${woStatus.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${woStatus.dot}`}></span>
                      <span>{woStatus.label}</span>
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">
                    {workOrder.client} — {workOrder.project}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <NotificationBell role="WORKER" />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6 modern-enter">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900 flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5" />
                  <span>Work Order Information</span>
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  {[
                    {
                      label: '1) DATE',
                      value: new Date(workOrder.date).toLocaleDateString('en-GB'),
                    },
                    { label: '2) CLIENT', value: workOrder.client },
                    { label: '3) PROJET', value: workOrder.project },
                    { label: '4) WORK ORDER', value: workOrder.workOrderNumber },
                    { label: '5) ITEM', value: workOrder.item },
                    { label: '6) REFERENCE', value: workOrder.reference },
                    { label: '7) COLOR & WAY', value: workOrder.colorAndWay },
                    { label: '8) TYPE', value: workOrder.type },
                    { label: '9) QUANTITY', value: workOrder.quantity },
                    { label: '10) DESIGN N', value: workOrder.designNumber },
                    { label: '11) DELIVERY', value: workOrder.deliveryWeek },
                  ].map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {field.label}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{field.value}</p>
                    </div>
                  ))}
                </div>

                {workOrder.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Notes</p>
                    <p className="text-sm text-gray-700 mt-1">{workOrder.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-4">Overall Progress</h2>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 50}`}
                        strokeDashoffset={`${2 * Math.PI * 50 * (1 - workOrder.progress / 100)}`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{workOrder.progress}%</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500 text-xs">Completed</p>
                    <p className="font-bold text-gray-900">
                      {
                        workOrder.stages.filter(
                          (stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED'
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500 text-xs">Remaining</p>
                    <p className="font-bold text-gray-900">
                      {
                        workOrder.stages.filter(
                          (stage) => stage.status === 'PENDING' || stage.status === 'IN_PROGRESS'
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
                <h2 className="font-bold text-gray-900">Quick Info</h2>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Created by</span>
                    <span className="font-medium text-gray-900">{workOrder.createdBy?.username}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Created at</span>
                    <span className="font-medium text-gray-900">{new Date(workOrder.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Delivery</span>
                    <span className="font-bold text-orange-600">{workOrder.deliveryWeek}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Quantity</span>
                    <span className="font-bold text-gray-900">{workOrder.quantity} units</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 flex items-center space-x-2">
                <Factory className="w-5 h-5" />
                <span>Production Stages</span>
              </h2>
            </div>

            <div className="p-6">
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 hidden sm:block" />

                <div className="space-y-4">
                  {sortedStages.map((stage, index) => {
                    const stageStatus = STATUS_CONFIG[stage.status] || STATUS_CONFIG.PENDING;

                    return (
                      <div key={stage.id} className="relative flex items-start space-x-4">
                        <div
                          className={`
                          relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl
                          border-4 transition-all
                          ${
                            stage.status === 'COMPLETED'
                              ? 'border-green-500 bg-green-50'
                              : stage.status === 'IN_PROGRESS'
                                ? 'border-blue-500 bg-blue-50'
                                : stage.status === 'SKIPPED'
                                  ? 'border-yellow-500 bg-yellow-50'
                                  : 'border-gray-300 bg-white'
                          }
                        `}
                        >
                          {stage.status === 'COMPLETED'
                            ? <CircleCheckBig className="w-8 h-8 text-green-600" />
                            : stage.status === 'IN_PROGRESS'
                              ? <Zap className="w-8 h-8 text-blue-600" />
                              : STAGE_ICONS[stage.subRole]}
                        </div>

                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-400 font-medium">Stage {index + 1}</span>
                                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold ${stageStatus.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stageStatus.dot}`}></span>
                                  <span>{stageStatus.label}</span>
                                </span>
                                {stage.id === currentStageId && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                    Your Task
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-gray-900 text-lg mt-1">{stage.subRole}</h3>
                              {stage.assignedTo && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="inline-flex items-center gap-1">
                                    <UserRound className="w-4 h-4" />
                                    {stage.assignedTo.username}
                                  </span>
                                  {stage.startedAt && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      Started: {new Date(stage.startedAt).toLocaleString()}
                                    </span>
                                  )}
                                </p>
                              )}
                              {stage.completedAt && (
                                <p className="text-xs text-green-600 mt-1">
                                  <span className="inline-flex items-center gap-1">
                                    <CircleCheckBig className="w-3.5 h-3.5" />
                                    Completed: {new Date(stage.completedAt).toLocaleString()}
                                  </span>
                                </p>
                              )}
                              {stage.notes && (
                                <p className="text-xs text-gray-500 mt-1 italic inline-flex items-center gap-1">
                                  <StickyNote className="w-3.5 h-3.5" />
                                  {stage.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
