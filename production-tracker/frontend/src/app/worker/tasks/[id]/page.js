'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import WorkOrderQRCode from '@/components/WorkOrderQRCode';
import api from '@/lib/axios';
import { notifyError, notifySuccess } from '@/lib/toast';
import {
  Pause,
  Zap,
  Save,
  CircleCheckBig,
  SkipForward,
  CircleX,
  Undo2,
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
  Ban,
  Edit,
  Trash2,
  X,
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
  const [updatingStage, setUpdatingStage] = useState(null);
  const [stageNotes, setStageNotes] = useState([]);
  const [isLoadingStageNotes, setIsLoadingStageNotes] = useState(false);
  const [savingNoteStageId, setSavingNoteStageId] = useState(null);
  const [stageNoteDrafts, setStageNoteDrafts] = useState({});
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [savingEditNoteId, setSavingEditNoteId] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

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
      await fetchStageNotes(selectedStageId);
    } catch (fetchError) {
      notifyError('Failed to load work order details');
      setWorkOrder(null);
      setStageNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStageNotes = async (selectedStageId) => {
    if (!selectedStageId) {
      setStageNotes([]);
      return;
    }

    setIsLoadingStageNotes(true);
    try {
      const response = await api.get(`/stages/${selectedStageId}/notes`);
      setStageNotes(response.data.notes || []);
    } catch (error) {
      setStageNotes([]);
    } finally {
      setIsLoadingStageNotes(false);
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

  const getBlockingStage = (stage, allStages) => {
    const currentIndex = STAGE_ORDER.indexOf(stage.subRole);
    if (currentIndex <= 0) return null;

    for (let index = 0; index < currentIndex; index += 1) {
      const previousSubRole = STAGE_ORDER[index];
      const previousStage = allStages.find((entry) => entry.subRole === previousSubRole);

      if (!previousStage) continue;
      if (!previousStage.assignedToId) continue;

      const isFinal = previousStage.status === 'COMPLETED' || previousStage.status === 'SKIPPED';
      if (!isFinal) return previousStage;
    }

    return null;
  };

  const handleStartTask = async (stage) => {
    setUpdatingStage(stage.id);

    try {
      await api.put(`/stages/${stage.id}`, { status: 'IN_PROGRESS' });
      notifySuccess('Task marked as in progress!');
      await fetchWorkOrderDetails(stage.id);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to start task');
    } finally {
      setUpdatingStage(null);
    }
  };

  const handleUpdateTaskStatus = async (stage, nextStatus) => {
    setUpdatingStage(stage.id);

    try {
      await api.put(`/stages/${stage.id}`, { status: nextStatus });
      notifySuccess(`Task marked as ${nextStatus.replace('_', ' ').toLowerCase()}!`);
      await fetchWorkOrderDetails(stage.id);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to update task');
    } finally {
      setUpdatingStage(null);
    }
  };

  const handleStageNoteDraftChange = (stageId, value) => {
    setStageNoteDrafts((previous) => ({
      ...previous,
      [stageId]: value,
    }));
  };

  const handleSaveStageNote = async (stage) => {
    const noteDraft = (stageNoteDrafts[stage.id] || '').trim();
    if (!noteDraft) {
      notifyError('Please write a note before saving');
      return;
    }

    setSavingNoteStageId(stage.id);
    try {
      const response = await api.post(`/stages/${stage.id}/notes`, { content: noteDraft });
      const createdNote = response.data.note;

      if (createdNote) {
        setStageNotes((previous) => [createdNote, ...previous]);
      }

      setWorkOrder((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          stages: previous.stages.map((entry) =>
            entry.id === stage.id
              ? {
                  ...entry,
                  notes: noteDraft,
                }
              : entry
          ),
        };
      });

      setStageNoteDrafts((previous) => ({
        ...previous,
        [stage.id]: '',
      }));

      notifySuccess('Note saved');
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to save note');
    } finally {
      setSavingNoteStageId(null);
    }
  };

  const handleEditNote = (noteId, currentContent) => {
    setEditingNoteId(noteId);
    setEditContent(currentContent);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleSaveEditedNote = async (stageId) => {
    if (!editContent.trim()) {
      notifyError('Note content cannot be empty');
      return;
    }

    if (editContent.length > 5000) {
      notifyError('Note content must be 5000 characters or less');
      return;
    }

    setSavingEditNoteId(editingNoteId);
    try {
      const response = await api.put(`/stages/${stageId}/notes/${editingNoteId}`, {
        content: editContent,
      });

      const updatedNote = response.data.note;
      setStageNotes((previous) =>
        previous.map((note) =>
          note.id === editingNoteId ? updatedNote : note
        )
      );

      handleCancelEdit();
      notifySuccess('Note updated successfully');
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to update note');
    } finally {
      setSavingEditNoteId(null);
    }
  };

  const handleDeleteNote = (noteId) => {
    setDeleteConfirmNoteId(noteId);
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async (stageId, noteId) => {
    setDeletingNoteId(noteId);
    try {
      await api.delete(`/stages/${stageId}/notes/${noteId}`);
      setStageNotes((previous) =>
        previous.filter((note) => note.id !== noteId)
      );

      setShowDeleteConfirmModal(false);
      setDeleteConfirmNoteId(null);
      notifySuccess('Note deleted successfully');
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
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

              <WorkOrderQRCode
                workOrderNumber={workOrder.workOrderNumber}
                qrCode={workOrder.qrCode}
              />
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
                    const isCurrentTask = stage.id === currentStageId;
                    const blockingStage =
                      isCurrentTask && stage.status === 'PENDING'
                        ? getBlockingStage(stage, workOrder.stages)
                        : null;
                    const isBlocked = Boolean(blockingStage);

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
                                  Latest note: {stage.notes}
                                </p>
                              )}

                              {isCurrentTask && stage.status === 'PENDING' && (
                                <div className="mt-3 space-y-2">
                                  {isBlocked && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                      <p className="text-xs text-amber-800 font-medium inline-flex items-center gap-1">
                                        <Ban className="w-3.5 h-3.5" />
                                        Blocked
                                      </p>
                                      <p className="text-sm text-amber-700 mt-1">
                                        Waiting for {blockingStage?.subRole} stage to be completed or skipped.
                                      </p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleStartTask(stage)}
                                    disabled={updatingStage === stage.id || isBlocked}
                                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Zap className="w-4 h-4" />
                                    <span>
                                      {updatingStage === stage.id
                                        ? 'Starting...'
                                        : isBlocked
                                          ? 'Blocked'
                                          : 'Start Task'}
                                    </span>
                                  </button>
                                </div>
                              )}

                              {isCurrentTask && stage.status === 'IN_PROGRESS' && (
                                <div className="mt-3 space-y-3">
                                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
                                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                                      Save Progress Note
                                    </p>
                                    <textarea
                                      value={stageNoteDrafts[stage.id] || ''}
                                      onChange={(event) => handleStageNoteDraftChange(stage.id, event.target.value)}
                                      rows={3}
                                      placeholder="Write what you did or what is blocking you..."
                                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                      onClick={() => handleSaveStageNote(stage)}
                                      disabled={savingNoteStageId === stage.id}
                                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Save className="w-4 h-4" />
                                      <span>{savingNoteStageId === stage.id ? 'Saving note...' : 'Save Notes'}</span>
                                    </button>
                                  </div>

                                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                                      Saved Notes History
                                    </p>
                                    {isLoadingStageNotes ? (
                                      <p className="text-sm text-gray-500">Loading notes...</p>
                                    ) : stageNotes.length === 0 ? (
                                      <p className="text-sm text-gray-500">No notes saved yet.</p>
                                    ) : (
                                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {stageNotes.map((noteEntry) => (
                                          <div key={noteEntry.id}>
                                            {editingNoteId === noteEntry.id ? (
                                              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 space-y-2">
                                                <textarea
                                                  value={editContent}
                                                  onChange={(e) => setEditContent(e.target.value)}
                                                  rows={2}
                                                  placeholder="Edit note..."
                                                  className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                  <button
                                                    onClick={handleCancelEdit}
                                                    className="inline-flex items-center gap-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-2 py-1 rounded text-xs font-medium transition"
                                                  >
                                                    <X className="w-3 h-3" />
                                                    Cancel
                                                  </button>
                                                  <button
                                                    onClick={() => handleSaveEditedNote(stage.id)}
                                                    disabled={savingEditNoteId === noteEntry.id}
                                                    className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                  >
                                                    <Save className="w-3 h-3" />
                                                    Save
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                                                <div className="flex justify-between items-start gap-2">
                                                  <div className="flex-1">
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{noteEntry.content}</p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                      {noteEntry.author?.username || 'Unknown'} - {new Date(noteEntry.createdAt).toLocaleString()}
                                                      {noteEntry.updatedAt && new Date(noteEntry.updatedAt).getTime() !== new Date(noteEntry.createdAt).getTime() && (
                                                        <span> (Edited: {new Date(noteEntry.updatedAt).toLocaleString()})</span>
                                                      )}
                                                    </p>
                                                  </div>
                                                  <div className="flex gap-1 flex-shrink-0">
                                                    <button
                                                      onClick={() => handleEditNote(noteEntry.id, noteEntry.content)}
                                                      className="p-1 text-gray-600 hover:bg-gray-200 rounded transition"
                                                      title="Edit note"
                                                    >
                                                      <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteNote(noteEntry.id)}
                                                      className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                                                      title="Delete note"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleUpdateTaskStatus(stage, 'COMPLETED')}
                                      disabled={updatingStage === stage.id}
                                      className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <CircleCheckBig className="w-4 h-4" />
                                      <span>{updatingStage === stage.id ? 'Saving...' : 'Mark Complete'}</span>
                                    </button>

                                    <button
                                      onClick={() => handleUpdateTaskStatus(stage, 'PENDING')}
                                      disabled={updatingStage === stage.id}
                                      className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Undo2 className="w-4 h-4" />
                                      <span>{updatingStage === stage.id ? 'Saving...' : 'Cancel Task'}</span>
                                    </button>
                                  </div>
                                </div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full">
            <div className="bg-red-50 px-6 py-4 border-b border-red-200">
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Note?
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete this note? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteConfirmNoteId(null);
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (currentStageId && deleteConfirmNoteId) {
                    handleConfirmDelete(currentStageId, deleteConfirmNoteId);
                  }
                }}
                disabled={deletingNoteId === deleteConfirmNoteId}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingNoteId === deleteConfirmNoteId ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
