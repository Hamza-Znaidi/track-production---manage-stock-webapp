'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import {
  BriefcaseBusiness,
  PencilRuler,
  MonitorCog,
  Store,
  Cog,
  Wrench,
  Search,
  Truck,
  CircleCheckBig,
  Hammer,
  PartyPopper,
  SearchX,
  Zap,
  StickyNote,
  Undo2,
  Ban,
  X,
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import api from '@/lib/axios';
import { notifyError, notifySuccess } from '@/lib/toast';

const STAGE_ICONS = {
  SALES: <BriefcaseBusiness className="text-blue-600" />, CAD:  <PencilRuler className="text-purple-600" />, CAM: <MonitorCog className="text-cyan-600" />,
  STORE: <Store className="text-orange-600" />, CNC: <Cog className=" text-red-600" />, ASSEMBLY: <Wrench className="text-amber-600" />,
  QUALITY: <Search className="text-green-600" />, DELIVERY: <Truck className="text-indigo-600" />,
};

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

export default function WorkerTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stages, setStages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

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
    setUser(currentUser);
    fetchTasks();
  }, [router]);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/stages/my-tasks');
      setStages(response.data.stages);
      setIsLoading(false);
    } catch (error) {
      notifyError('Failed to load tasks');
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const handleUpdateStatus = async (stageId, newStatus, notes = '') => {
    setUpdatingStage(stageId);
    try {
      await api.put(`/stages/${stageId}`, {
        status: newStatus,
        notes: notes || undefined,
      });
      notifySuccess(`Task marked as ${newStatus.replace('_', ' ').toLowerCase()}!`);
      fetchTasks();
      setNotesModal(null);
      setNotesText('');
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to update task');
    } finally {
      setUpdatingStage(null);
    }
  };

  const openNotesModal = (stage) => {
    setNotesModal(stage);
    setNotesText(stage.notes || '');
  };

  const openTaskDetails = (stageId) => {
    router.push(`/worker/tasks/${stageId}`);
  };

  const activeTasksCount = stages.filter(
    (stage) => stage.status === 'PENDING' || stage.status === 'IN_PROGRESS'
  ).length;
  const completedTasksCount = stages.filter((stage) => stage.status === 'COMPLETED').length;

  const filteredStages = stages.filter((stage) => {
    const matchesTab = activeTab === 'ACTIVE'
      ? stage.status === 'PENDING' || stage.status === 'IN_PROGRESS'
      : stage.status === 'COMPLETED';

    if (!matchesTab) return false;

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;

    const searchableText = [
      stage.subRole,
      stage.workOrder?.workOrderNumber,
      stage.workOrder?.client,
      stage.workOrder?.project,
      stage.workOrder?.item,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

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
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Tasks</h1>
              <p className="text-gray-600 mt-1">
                {stages.length} task{stages.length !== 1 ? 's' : ''} assigned to you
              </p>
            </div>
            <NotificationBell role="WORKER" />
          </div>
        </header>

        <main className="p-4 sm:p-8 modern-enter">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-sm text-gray-500">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stages.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stages.filter(s => s.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stages.filter(s => s.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">
                {stages.filter(s => s.status === 'PENDING').length}
              </p>
            </div>
          </div>

          {/* My Sub-Roles */}
          {user?.subRoles?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 modern-hover">
              <p className="text-sm font-semibold text-gray-700 mb-3">My Departments:</p>
              <div className="flex flex-wrap gap-2">
                {user.subRoles.map((sr) => (
                  <span key={sr} className="inline-flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium border border-indigo-100">
                    <span>{STAGE_ICONS[sr]}</span>
                    <span>{sr}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 modern-hover">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('ACTIVE')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition relative ${
                  activeTab === 'ACTIVE'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Hammer className="w-4 h-4" />
                  Pending / In Progress
                </span>
                {activeTasksCount > 0 && (
                  <span className="ml-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {activeTasksCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('COMPLETED')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition relative ${
                  activeTab === 'COMPLETED'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig className="w-4 h-4" />
                  Completed
                </span>
                {completedTasksCount > 0 && (
                  <span className="ml-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {completedTasksCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 modern-hover">
            <div className="flex-1 min-w-48 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by WO, client, project, item, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Tasks List */}
          {stages.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center modern-hover">
              <PartyPopper className="w-14 h-14 mb-4 mx-auto text-indigo-500" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">You have no tasks assigned right now.</p>
            </div>
          ) : filteredStages.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center modern-hover">
              <SearchX className="w-14 h-14 mb-4 mx-auto text-gray-400" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Tasks Found</h3>
              <p className="text-gray-500">Try changing the tab or search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStages.map((stage) => {
                const statusConfig = STATUS_CONFIG[stage.status] || STATUS_CONFIG.PENDING;
                const isUpdating = updatingStage === stage.id;
                const isBlocked = stage.status === 'PENDING' && stage.isBlocked;

                return (
                  <div
                    key={stage.id}
                    onClick={() => openTaskDetails(stage.id)}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition modern-hover cursor-pointer"
                  >
                    {/* Stage Header */}
                    <div className={`px-6 py-3 flex items-center justify-between ${
                      stage.status === 'IN_PROGRESS' ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span>{STAGE_ICONS[stage.subRole]}</span>
                        <div>
                          <p className="font-bold text-white">{stage.subRole} Department</p>
                          <p className="text-xs text-white opacity-75 font-mono">
                            {stage.workOrder.workOrderNumber}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Stage Body */}
                    <div className="p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Client</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {stage.workOrder.client}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Project</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {stage.workOrder.project}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Item</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {stage.workOrder.item}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Quantity</p>
                          <p className="text-sm font-bold text-indigo-600 mt-1">
                            {stage.workOrder.quantity} units
                          </p>
                        </div>
                      </div>

                      {/* Delivery Week */}
                      <div className="flex items-center space-x-2 mb-5">
                        <span className="text-xs text-gray-500">Delivery:</span>
                        <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">
                          {stage.workOrder.deliveryWeek}
                        </span>
                      </div>

                      {/* Notes */}
                      {stage.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5">
                          <p className="text-xs text-yellow-800 font-medium inline-flex items-center gap-1">
                            <StickyNote className="w-3.5 h-3.5" />
                            Notes:
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">{stage.notes}</p>
                        </div>
                      )}

                      {isBlocked && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                          <p className="text-xs text-amber-800 font-medium inline-flex items-center gap-1">
                            <Ban className="w-3.5 h-3.5" />
                            Blocked
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            Waiting for {stage.blockedBySubRole} stage to be completed or skipped.
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3">
                        {stage.status === 'PENDING' && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleUpdateStatus(stage.id, 'IN_PROGRESS');
                            }}
                            disabled={isUpdating || isBlocked}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed modern-hover modern-pulse"
                          >
                            {isUpdating ? (
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : <Zap className="w-4 h-4" />}
                            <span>{isBlocked ? 'Blocked' : 'Start Task'}</span>
                          </button>
                        )}

                        {stage.status === 'IN_PROGRESS' && (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openNotesModal(stage);
                              }}
                              disabled={isUpdating}
                              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 modern-hover modern-pulse"
                            >
                              <CircleCheckBig className="w-4 h-4" />
                              <span>Mark Complete</span>
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openNotesModal(stage);
                              }}
                              className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-medium transition modern-hover"
                            >
                              <StickyNote className="w-4 h-4" />
                              <span>Add Note</span>
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleUpdateStatus(stage.id, 'PENDING');
                              }}
                              disabled={isUpdating}
                              className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 modern-hover"
                            >
                              {isUpdating ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                ) : <Undo2 className="w-4 h-4" />}
                              <span>Cancel Task</span>
                            </button>
                          </>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Complete Task — {notesModal.subRole}
              </h3>
              <button
                onClick={() => setNotesModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm"
                  placeholder="Add any notes about this task completion..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setNotesModal(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateStatus(notesModal.id, 'COMPLETED', notesText)}
                  disabled={updatingStage === notesModal.id}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                >
                  {updatingStage === notesModal.id ? 'Completing...' : 'Complete Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}