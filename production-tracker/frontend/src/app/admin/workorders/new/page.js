'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { FileSearchCorner,Users,CircleAlert,Info, SquarePen ,Form , Route ,Zap,CircleCheckBig,SkipForward,CircleX, CircleDotDashed,BriefcaseBusiness,PencilRuler,MonitorCog,Store,Cog,Wrench,Search,Truck,UserRoundSearch,RotateCcw,MessageSquareShare,EllipsisVertical,Sparkles } from "lucide-react";
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import StageWorkerDropdown from '@/components/StageWorkerDropdown';
import api from '@/lib/axios';
import { notifyError } from '@/lib/toast';

const AUTO_ASSIGN_DEFAULTS_STORAGE_KEY = 'woAutoAssignDefaults:v1';

const PRODUCTION_STAGES = [
  { value: 'SALES', label: 'Sales', icon: <BriefcaseBusiness className="text-blue-600" />},
  { value: 'CAD', label: 'CAD', icon: <PencilRuler className="text-purple-600" />},
  { value: 'CAM', label: 'CAM', icon: <MonitorCog className="text-cyan-600" /> },
  { value: 'STORE', label: 'Store', icon: <Store className="text-orange-600" /> },
  { value: 'CNC', label: 'CNC', icon: <Cog className=" text-red-600" /> },
  { value: 'ASSEMBLY', label: 'Assembly', icon: <Wrench className="text-amber-600" /> },
  { value: 'QUALITY', label: 'Quality', icon: <Search className=" text-green-600" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <Truck className=" text-indigo-600" /> },
];

const createEmptyAssignments = () =>
  PRODUCTION_STAGES.reduce((accumulator, stage) => {
    accumulator[stage.value] = null;
    return accumulator;
  }, {});

export default function NewWorkOrderPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [stageAssignments, setStageAssignments] = useState(createEmptyAssignments);
  const [defaultStageAssignments, setDefaultStageAssignments] = useState(createEmptyAssignments);
  const [draftDefaultAssignments, setDraftDefaultAssignments] = useState(createEmptyAssignments);
  const [isAutoAssignMenuOpen, setIsAutoAssignMenuOpen] = useState(false);
  const [isDefaultConfigOpen, setIsDefaultConfigOpen] = useState(false);
  const autoAssignMenuRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
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

    let isMounted = true;

    const loadWorkers = async () => {
      try {
        const response = await api.get('/auth/users');
        if (!isMounted) return;

        const allWorkers = response.data.users.filter((worker) => worker.role === 'WORKER');
        setWorkers(allWorkers);
      } catch (error) {
        console.error('Error fetching workers:', error);
      } finally {
        if (isMounted) {
          setLoadingWorkers(false);
        }
      }
    };

    void loadWorkers();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const sanitizeAssignments = (assignments, availableWorkersList) => {
    return PRODUCTION_STAGES.reduce((accumulator, stage) => {
      const rawValue = assignments?.[stage.value];
      const parsedValue = Number(rawValue);

      if (!rawValue || Number.isNaN(parsedValue)) {
        accumulator[stage.value] = null;
        return accumulator;
      }

      const isEligible = availableWorkersList.some(
        (worker) => worker.id === parsedValue && worker.subRoles?.includes(stage.value),
      );
      accumulator[stage.value] = isEligible ? parsedValue : null;
      return accumulator;
    }, {});
  };

  const persistDefaultAssignments = (assignments) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(AUTO_ASSIGN_DEFAULTS_STORAGE_KEY, JSON.stringify(assignments));
    } catch (error) {
      console.error('Failed to persist auto-assign defaults:', error);
    }
  };

  // Get workers who have the specific sub-role
  const getWorkersForStage = (subRole) => {
    return workers.filter(w => w.subRoles?.includes(subRole));
  };

  const handleStageAssignment = (subRole, userId) => {
    setStageAssignments(prev => ({
      ...prev,
      [subRole]: userId ? parseInt(userId) : null,
    }));
  };

  const handleAutoAssignDefaults = () => {
    const hasAtLeastOneDefault = Object.values(defaultStageAssignments).some(Boolean);

    if (!hasAtLeastOneDefault) {
      notifyError('No default auto-assignments found. Configure them from the 3-dot menu first.');
      return;
    }

    setStageAssignments({ ...defaultStageAssignments });
    setIsAutoAssignMenuOpen(false);
  };

  const openDefaultConfig = () => {
    setDraftDefaultAssignments({ ...defaultStageAssignments });
    setIsAutoAssignMenuOpen(false);
    setIsDefaultConfigOpen(true);
  };

  const saveDefaultConfig = () => {
    const sanitizedDefaults = sanitizeAssignments(draftDefaultAssignments, workers);
    setDefaultStageAssignments(sanitizedDefaults);
    persistDefaultAssignments(sanitizedDefaults);
    setIsDefaultConfigOpen(false);
  };

  useEffect(() => {
    if (loadingWorkers) return;

    if (typeof window === 'undefined') return;

    try {
      const storedDefaults = localStorage.getItem(AUTO_ASSIGN_DEFAULTS_STORAGE_KEY);
      if (!storedDefaults) return;

      const parsedDefaults = JSON.parse(storedDefaults);
      const sanitizedDefaults = sanitizeAssignments(parsedDefaults, workers);
      setDefaultStageAssignments(sanitizedDefaults);
      persistDefaultAssignments(sanitizedDefaults);
    } catch (error) {
      console.error('Failed to load auto-assign defaults:', error);
    }
  }, [loadingWorkers, workers]);

  useEffect(() => {
    if (!isAutoAssignMenuOpen) return;

    const handleClickOutside = (event) => {
      if (autoAssignMenuRef.current && !autoAssignMenuRef.current.contains(event.target)) {
        setIsAutoAssignMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAutoAssignMenuOpen]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await api.post('/workorders', {
        ...data,
        stageAssignments, // Include stage assignments
      });
      router.push(`/admin/workorders/${response.data.workOrder.id}`);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to create work order');
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition text-black dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 modern-hover";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const errorClass = "text-red-500 text-xs mt-1";

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="ADMIN" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/workorders')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Work Order</h1>
                <p className="text-gray-600 mt-1">Fill in the details and assign workers</p>
              </div>
            </div>
            <NotificationBell role="ADMIN" />
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6 modern-enter">
          {/* KTS Header Banner */}
          <div className="bg-indigo-600 rounded-xl p-5 mb-8 flex items-center  space-x-4">
            <div className="bg-white rounded-lg p-2">
            <Form className='text-indigo-600'/>
            </div>
            <div className="text-white ">
              <h2 className="font-bold text-lg">KTS Work Order Form</h2>
              
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Work Order Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Work Order Details</h3>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DATE */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">1)</span>DATE
                  </label>
                  <input
                    type="date"
                    {...register('date', { required: 'Date is required' })}
                    className={inputClass}
                  />
                  {errors.date && <p className={errorClass}>{errors.date.message}</p>}
                </div>

                {/* CLIENT */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">2)</span>CLIENT
                  </label>
                  <input
                    type="text"
                    {...register('client', { required: 'Client is required' })}
                    className={inputClass}
                    placeholder="Enter client name"
                  />
                  {errors.client && <p className={errorClass}>{errors.client.message}</p>}
                </div>

                {/* PROJET */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">3)</span>PROJET
                  </label>
                  <input
                    type="text"
                    {...register('project', { required: 'Project is required' })}
                    className={inputClass}
                    placeholder="Enter project name"
                  />
                  {errors.project && <p className={errorClass}>{errors.project.message}</p>}
                </div>

                {/* WORK ORDER */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">4)</span>WORK ORDER
                  </label>
                  <input
                    type="text"
                    {...register('workOrderNumber', { required: 'Work order is required' })}
                    className={inputClass}
                    placeholder="Enter work order number"
                  />
                  {errors.workOrderNumber && <p className={errorClass}>{errors.workOrderNumber.message}</p>}
                  <p className='text-red-400 text-sm '>Be careful this field cannot be changed once submitted </p>
                </div>

                {/* ITEM */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">5)</span>ITEM
                  </label>
                  <input
                    type="text"
                    {...register('item', { required: 'Item is required' })}
                    className={inputClass}
                    placeholder="Enter item description"
                  />
                  {errors.item && <p className={errorClass}>{errors.item.message}</p>}
                </div>

                {/* REFERENCE */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">6)</span>REFERENCE
                  </label>
                  <input
                    type="text"
                    {...register('reference', { required: 'Reference is required' })}
                    className={inputClass}
                    placeholder="Enter reference number"
                  />
                  {errors.reference && <p className={errorClass}>{errors.reference.message}</p>}
                </div>

                {/* COLOR & WAY */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">7)</span>COLOR & WAY
                  </label>
                  <input
                    type="text"
                    {...register('colorAndWay', { required: 'Color & Way is required' })}
                    className={inputClass}
                    placeholder="e.g. Red / Left"
                  />
                  {errors.colorAndWay && <p className={errorClass}>{errors.colorAndWay.message}</p>}
                </div>

                {/* TYPE */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">8)</span>TYPE
                  </label>
                  <input
                    type="text"
                    {...register('type', { required: 'Type is required' })}
                    className={inputClass}
                    placeholder="Enter product type"
                  />
                  {errors.type && <p className={errorClass}>{errors.type.message}</p>}
                </div>

                {/* QUANTITY */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">9)</span>QUANTITY
                  </label>
                  <input
                    type="number"
                    min="1"
                    {...register('quantity', {
                      required: 'Quantity is required',
                      min: { value: 1, message: 'Must be at least 1' },
                    })}
                    className={inputClass}
                    placeholder="Enter quantity"
                  />
                  {errors.quantity && <p className={errorClass}>{errors.quantity.message}</p>}
                </div>

                {/* DESIGN N */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">10)</span>DESIGN N
                  </label>
                  <input
                    type="text"
                    {...register('designNumber', { required: 'Design number is required' })}
                    className={inputClass}
                    placeholder="Enter design number"
                  />
                  {errors.designNumber && <p className={errorClass}>{errors.designNumber.message}</p>}
                </div>

                {/* DELIVERY */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">11)</span>DELIVERY
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">WK</span>
                    <input
                      type="number"
                      min="1"
                      {...register('deliveryWeek', {
                        required: 'Delivery week is required',
                        pattern: {
                          value: /^\d+$/,
                          message: 'Enter week number only (e.g. 12)',
                        },
                      })}
                      className={`${inputClass} pl-10`}
                      placeholder="12"
                    />
                  </div>
                  {errors.deliveryWeek && <p className={errorClass}>{errors.deliveryWeek.message}</p>}
                </div>

                {/* NOTES */}
                <div className="md:col-span-2">
                  <label className={labelClass}>
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className={inputClass}
                    placeholder="Any additional notes or instructions..."
                  />
                </div>
              </div>
            </div>

            {/* Stage Assignments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between gap-3 dark:bg-indigo-900/20 dark:border-indigo-400">
                <h3 className="font-semibold text-indigo-900 flex items-center space-x-2">
                  <span><Users/></span>
                  <span>Production Stage Assignments</span>
                  <span className="text-xs font-normal text-indigo-600">(Optional - can be assigned later)</span>
                </h3>

                <div className="flex items-center gap-2" ref={autoAssignMenuRef}>
                  <button
                    type="button"
                    onClick={handleAutoAssignDefaults}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Auto Assign</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAutoAssignMenuOpen((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-white p-2 text-indigo-700 hover:bg-indigo-100 transition"
                    aria-label="Auto-assign configuration"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>

                  {isAutoAssignMenuOpen && (
                    <div className="absolute z-30 mt-32 right-8 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <button
                        type="button"
                        onClick={openDefaultConfig}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        Configure default auto-assignments
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6">
                {loadingWorkers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-3">Loading workers...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PRODUCTION_STAGES.map((stage, index) => {
                      const availableWorkers = getWorkersForStage(stage.value);
                      const selectedWorkerId = stageAssignments[stage.value];
                      
                      return (
                        <div key={stage.value} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="text-gray-400 font-bold text-xs">Stage {index + 1}</span>
                            <span className="text-xl">{stage.icon}</span>
                            <span className="font-semibold text-gray-900">{stage.label}</span>
                          </div>

                          {availableWorkers.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-xs text-yellow-700">
                                 <CircleAlert className="inline-block mr-1" /> No workers with {stage.label} sub-role
                              </p>
                            </div>
                          ) : (
                            <StageWorkerDropdown
                              selectedWorkerId={selectedWorkerId}
                              availableWorkers={availableWorkers}
                              onSelect={(value) => handleStageAssignment(stage.value, value)}
                            />
                            
                          )}

                          {selectedWorkerId && (
                            <p className="text-xs text-green-600 mt-2">
                              <CircleCheckBig className="inline-block mr-1" /> Assigned to {availableWorkers.find(w => w.id === selectedWorkerId)?.username}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-400">
                  <p className="text-sm text-blue-800">
                    <strong><Info className='inline' /> Note:</strong> You can assign workers to stages now or leave them unassigned. 
                    Workers can be assigned or reassigned later from the work order detail page.
                  </p>
                </div>
              </div>
            </div>

            {isDefaultConfigOpen && (
              <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Default Auto-Assignments</h3>
                    <button
                      type="button"
                      onClick={() => setIsDefaultConfigOpen(false)}
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[65vh] space-y-4">
                    {PRODUCTION_STAGES.map((stage, index) => {
                      const availableWorkers = getWorkersForStage(stage.value);
                      const selectedWorkerId = draftDefaultAssignments[stage.value];

                      return (
                        <div key={`default-${stage.value}`} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="text-gray-400 font-bold text-xs">Stage {index + 1}</span>
                            <span className="text-xl">{stage.icon}</span>
                            <span className="font-semibold text-gray-900">{stage.label}</span>
                          </div>

                          {availableWorkers.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-xs text-yellow-700">
                                <CircleAlert className="inline-block mr-1" /> No workers with {stage.label} sub-role
                              </p>
                            </div>
                          ) : (
                            <StageWorkerDropdown
                              selectedWorkerId={selectedWorkerId}
                              availableWorkers={availableWorkers}
                              onSelect={(value) => {
                                setDraftDefaultAssignments((prev) => ({
                                  ...prev,
                                  [stage.value]: value ? parseInt(value, 10) : null,
                                }));
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDefaultConfigOpen(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveDefaultConfig}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Save defaults
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Form Footer */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={() => router.push('/admin/workorders')}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Create Work Order</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}