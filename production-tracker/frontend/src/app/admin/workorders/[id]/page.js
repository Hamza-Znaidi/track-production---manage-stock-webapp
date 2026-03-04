"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearchCorner, SquarePen  , Route ,Zap,CircleCheckBig,SkipForward,CircleX, CircleDotDashed,BriefcaseBusiness,PencilRuler,MonitorCog,Store,Cog,Wrench,Search,Truck,UserRoundSearch,RotateCcw,MessageSquareShare} from "lucide-react";
import authService from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import AppDropdown from "@/components/AppDropdown";
import api from "@/lib/axios";
import chatAPI from "@/lib/chat";
import { notifyError, notifySuccess } from "@/lib/toast";

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    color: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
    icon:  <CircleDotDashed />,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    icon: <Zap className="w-4 h-4" />,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    icon: <CircleCheckBig />,
  },
  SKIPPED: {
    label: "Skipped",
    color: "bg-yellow-100 text-yellow-700",
    dot: "bg-yellow-500",
    icon: <SkipForward className="w-4 h-4" />,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: <CircleX className="w-4 h-4" />,
  },
};

const STAGE_ORDER = [
  "SALES",
  "CAD",
  "CAM",
  "STORE",
  "CNC",
  "ASSEMBLY",
  "QUALITY",
  "DELIVERY",
];

const STAGE_ICONS = {
  SALES: <BriefcaseBusiness className="text-blue-600" />,
  CAD: <PencilRuler className="text-purple-600" />,
  CAM: <MonitorCog className="text-cyan-600" />,
  STORE: <Store className="text-orange-600" />,
  CNC: <Cog className=" text-red-600" />,
  ASSEMBLY: <Wrench className="text-amber-600" />,
  QUALITY: <Search className=" text-green-600" />,
  DELIVERY: <Truck className=" text-indigo-600" />,
};

export default function WorkOrderDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedWorkerForAssignment, setSelectedWorkerForAssignment] =useState('');
  const [isOpeningWorkOrderChat, setIsOpeningWorkOrderChat] = useState(false);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/");
      return;
    }
    const currentUser = authService.getCurrentUser();
    if (currentUser.role !== "ADMIN") {
      router.push("/worker");
      return;
    }
    fetchWorkOrder();
    fetchWorkers();
  }, []);

  const fetchWorkOrder = async () => {
    try {
      const response = await api.get(`/workorders/${params.id}`);
      setWorkOrder(response.data.workOrder);
      setIsLoading(false);
    } catch (error) {
      notifyError("Failed to load work order");
      setIsLoading(false);
    }
  };
  const fetchWorkers = async () => {
  try {
    const response = await api.get('/auth/users');
    const allWorkers = response.data.users.filter(u => u.role === 'WORKER');
    setWorkers(allWorkers);
  } catch (error) {
    console.error('Error fetching workers:', error);
  }
};

  const handleLogout = () => {
    authService.logout();
    router.push("/");
  };

  const handleOpenWorkOrderChat = async () => {
    if (!workOrder?.id) return;

    try {
      setIsOpeningWorkOrderChat(true);
      const thread = await chatAPI.createWorkOrderThread(
        workOrder.id,
        workOrder.workOrderNumber
      );
      router.push(`/admin/chat?thread=${thread.id}`);
    } catch (openChatError) {
      notifyError(
        openChatError.response?.data?.error ||
          "Failed to open work order conversation"
      );
    } finally {
      setIsOpeningWorkOrderChat(false);
    }
  };

  // Admin can manually update stage status
  const handleStageUpdate = async (stageId, newStatus) => {
    setUpdatingStage(stageId);
    try {
      await api.put(`/stages/${stageId}`, { status: newStatus });
      notifySuccess("Stage updated successfully");
      await fetchWorkOrder();
    } catch (error) {
      notifyError("Failed to update stage");
    } finally {
      setUpdatingStage(null);
    }
  };


// assignment handler functions
const handleAssignWorker = (stage) => {
  setAssignModal(stage);
  setSelectedWorkerForAssignment(stage.assignedTo?.id || '');
};

const handleConfirmAssignment = async () => {
  if (!assignModal) return;

  try {
    const workerId = selectedWorkerForAssignment ? parseInt(selectedWorkerForAssignment) : null;
    
    await api.put(`/stages/${assignModal.id}`, {
      status: assignModal.status,
      assignedToId: workerId,
    });

    notifySuccess(workerId ? 'Worker assigned successfully' : 'Worker unassigned');
    await fetchWorkOrder();
    setAssignModal(null);
    setSelectedWorkerForAssignment('');
  } catch (error) {
    notifyError(error.response?.data?.error || 'Failed to assign worker');
  }
};

const getWorkersForStage = (subRole) => {
  return workers.filter(w => w.subRoles?.includes(subRole));
};



  // Sort stages by production order
  const getSortedStages = (stages) => {
    return [...stages].sort(
      (a, b) => STAGE_ORDER.indexOf(a.subRole) - STAGE_ORDER.indexOf(b.subRole),
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
          <p className="text-2xl font-bold text-gray-900">
            Work Order Not Found
          </p>
          <button
            onClick={() => router.push("/admin/workorders")}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg"
          >
            Back to Work Orders
          </button>
        </div>
      </div>
    );
  }

  const sortedStages = getSortedStages(workOrder.stages);
  const woStatus = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="ADMIN" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push("/admin/workorders")}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900 font-mono">
                      {workOrder.workOrderNumber}
                    </h1>
                    <span
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${woStatus.color}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${woStatus.dot}`}
                      ></span>
                      <span>{woStatus.label}</span>
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">
                    {workOrder.client} — {workOrder.project}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <NotificationBell role="ADMIN" />
                <button
                  onClick={handleOpenWorkOrderChat}
                  disabled={isOpeningWorkOrderChat}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm font-medium"
                >
                  <MessageSquareShare />
                  <span>
                    {isOpeningWorkOrderChat ? "Opening..." : "Open Chat"}
                  </span>
                </button>
                <button
                  onClick={() =>
                    router.push(`/admin/workorders/${workOrder.id}/edit`)
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm font-medium"
                >
                   <SquarePen />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>
        </header>

          <main className="p-4 sm:p-8 space-y-6 modern-enter">
          {/* Work Order Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900 flex items-center space-x-2">
                  <FileSearchCorner />
                  <span>Work Order Information</span>
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  {[
                    {
                      label: "1) DATE",
                      value: new Date(workOrder.date).toLocaleDateString(
                        "en-GB",
                      ),
                    },
                    { label: "2) CLIENT", value: workOrder.client },
                    { label: "3) PROJET", value: workOrder.project },
                    { label: "4) WORK ORDER", value: workOrder.workOrderNumber },
                    { label: "5) ITEM", value: workOrder.item },
                    { label: "6) REFERENCE", value: workOrder.reference },
                    { label: "7) COLOR & WAY", value: workOrder.colorAndWay },
                    { label: "8) TYPE", value: workOrder.type },
                    { label: "9) QUANTITY", value: workOrder.quantity },
                    { label: "10) DESIGN N", value: workOrder.designNumber },
                    { label: "11) DELIVERY", value: workOrder.deliveryWeek },
                  ].map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {field.label}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>

                {workOrder.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      Notes
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {workOrder.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Card */}
            <div className="space-y-4">
              {/* Overall Progress */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-4">
                  Overall Progress
                </h2>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                      />
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
                      <span className="text-2xl font-bold text-gray-900">
                        {workOrder.progress}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500 text-xs">Completed</p>
                    <p className="font-bold text-gray-900">
                      {
                        workOrder.stages.filter(
                          (s) =>
                            s.status === "COMPLETED" || s.status === "SKIPPED",
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500 text-xs">Remaining</p>
                    <p className="font-bold text-gray-900">
                      {
                        workOrder.stages.filter(
                          (s) =>
                            s.status === "PENDING" ||
                            s.status === "IN_PROGRESS",
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
                <h2 className="font-bold text-gray-900">Quick Info</h2>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Created by</span>
                    <span className="font-medium text-gray-900">
                      {workOrder.createdBy?.username}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Created at</span>
                    <span className="font-medium text-gray-900">
                      {new Date(workOrder.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Delivery</span>
                    <span className="font-bold text-orange-600">
                      {workOrder.deliveryWeek}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Quantity</span>
                    <span className="font-bold text-gray-900">
                      {workOrder.quantity} units
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Production Stages */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 flex items-center space-x-2">
                <Route />
                <span>Production Stages</span>
              </h2>
            </div>

            {/* Stage Timeline */}
            <div className="p-6">
              <div className="relative">
                {/* Connecting line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 hidden sm:block" />

                <div className="space-y-4">
                  {sortedStages.map((stage, index) => {
                    const stageStatus =
                      STATUS_CONFIG[stage.status] || STATUS_CONFIG.PENDING;
                    const isUpdating = updatingStage === stage.id;

                    return (
                      <div
                        key={stage.id}
                        className="relative flex items-start space-x-4"
                      >
                        {/* Stage Icon */}
                        <div
                          className={`
                          relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl
                          border-4 transition-all
                          ${
                            stage.status === "COMPLETED"
                              ? "border-green-500 bg-green-50"
                              : stage.status === "IN_PROGRESS"
                                ? "border-blue-500 bg-blue-50"
                                : stage.status === "SKIPPED"
                                  ? "border-yellow-500 bg-yellow-50"
                                  : "border-gray-300 bg-white"
                          }
                        `}
                        >
                          {stage.status === "COMPLETED"
                            ? <CircleCheckBig className="w-8 h-8 text-green-500" />
                            : stage.status === "IN_PROGRESS"
                              ? <Zap className="w-8 h-8 text-blue-500" />
                              : stage.status === "SKIPPED"
                                ? <SkipForward className="w-8 h-8 text-yellow-500" />
                              : STAGE_ICONS[stage.subRole]}
                        </div>

                        {/* Stage Content */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-400 font-medium">
                                  Stage {index + 1}
                                </span>
                                <span
                                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold ${stageStatus.color}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${stageStatus.dot}`}
                                  ></span>
                                  <span>{stageStatus.label}</span>
                                </span>
                              </div>
                              <h3 className="font-bold text-gray-900 text-lg mt-1">
                                {stage.subRole}
                              </h3>
                              {stage.assignedTo && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <UserRoundSearch className="w-4 h-4 mr-1" /> {stage.assignedTo.username}
                                  {stage.startedAt && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      Started:{" "}
                                      {new Date(
                                        stage.startedAt,
                                      ).toLocaleString()}
                                    </span>
                                  )}
                                </p>
                              )}
                              {stage.completedAt && (
                                <p className="text-xs text-green-600 mt-1">
                                  <CircleCheckBig className="w-4 h-4 mr-1" /> Completed:{" "}
                                  {new Date(stage.completedAt).toLocaleString()}
                                </p>
                              )}
                              {stage.notes && (
                                <p className="text-xs text-gray-500 mt-1 italic">
                                  <NotebookPen className="w-4 h-4 mr-1" /> {stage.notes}
                                </p>
                              )}
                            </div>

                            {/* Admin Stage Controls */}
                            <div className="flex flex-wrap gap-2">
                              {/* Assign/Reassign Worker Button */}
                              <button
                                onClick={() => handleAssignWorker(stage)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition flex items-center gap-1"
                              >
                                {stage.assignedTo ? (
                                  <>
                                    <UserRoundSearch className="w-4 h-4" />
                                    Reassign
                                  </>
                                ) : (
                                  <>
                                    <UserRoundSearch className="w-4 h-4" />
                                     Assign Worker
                                  </>
                                )}
                              </button>

                              {stage.status !== "COMPLETED" && (
                                <button
                                  onClick={() =>
                                    handleStageUpdate(stage.id, "COMPLETED")
                                  }
                                  disabled={isUpdating}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                                >
                                  {isUpdating ? "..." : <><CircleCheckBig className="w-4 h-4 mr-1" /> Mark Complete</>}
                                </button>
                              )}
                              {stage.status === "PENDING" && (
                                <button
                                  onClick={() =>
                                    handleStageUpdate(stage.id, "SKIPPED")
                                  }
                                  disabled={isUpdating}
                                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                                >
                                  <SkipForward className="" /> Skip
                                </button>
                              )}
                              {stage.status !== "PENDING" && (
                                <button
                                  onClick={() =>
                                    handleStageUpdate(stage.id, "PENDING")
                                  }
                                  disabled={isUpdating}
                                  className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" /> Reset
                                </button>
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
      {/* Assignment Modal */}
{assignModal && (
  <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Assign Worker to {assignModal.subRole}
        </h3>
        <button
          onClick={() => setAssignModal(null)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Worker
          </label>
          {getWorkersForStage(assignModal.subRole).length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ No workers with {assignModal.subRole} sub-role available
            </div>
          ) : (
            <AppDropdown
              value={selectedWorkerForAssignment}
              onValueChange={setSelectedWorkerForAssignment}
              options={[
                { value: '', label: 'Unassigned' },
                ...getWorkersForStage(assignModal.subRole).map((worker) => ({
                  value: String(worker.id),
                  label: worker.username,
                })),
              ]}
              className="w-full px-4 py-2.5"
            />
          )}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setAssignModal(null)}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAssignment}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            {selectedWorkerForAssignment ? 'Assign Worker' : 'Unassign'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
