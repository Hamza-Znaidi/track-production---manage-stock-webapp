'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AppDropdown from '@/components/AppDropdown';
import api from '@/lib/axios';
import { notifyError } from '@/lib/toast';

export default function EditWorkOrderPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workOrderNumber, setWorkOrderNumber] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const fetchWorkOrder = useCallback(async () => {
    try {
      const response = await api.get(`/workorders/${params.id}`);
      const wo = response.data.workOrder;
      setWorkOrderNumber(wo.workOrderNumber);

      // Pre-fill form with existing data
      reset({
        date: new Date(wo.date).toISOString().split('T')[0],
        client: wo.client,
        project: wo.project,
        item: wo.item,
        reference: wo.reference,
        colorAndWay: wo.colorAndWay,
        type: wo.type,
        quantity: wo.quantity,
        designNumber: wo.designNumber,
        deliveryWeek: String(wo.deliveryWeek || '').replace(/^WK/i, ''),
        status: wo.status,
        notes: wo.notes || '',
      });

      setIsLoading(false);
    } catch (error) {
      notifyError('Failed to load work order');
      setIsLoading(false);
    }
  }, [params.id, reset]);

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
    Promise.resolve().then(() => fetchWorkOrder());
  }, [fetchWorkOrder, router]);

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await api.put(`/workorders/${params.id}`, data);
      router.push(`/admin/workorders/${params.id}`);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to update work order');
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition text-black dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 modern-hover";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const errorClass = "text-red-500 text-xs mt-1";

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
          <div className="px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/admin/workorders/${params.id}`)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Edit Work Order
                </h1>
                <p className="text-gray-600 mt-1 font-mono text-sm">
                  {workOrderNumber}
                </p>
              </div>
            </div>
            <NotificationBell role="ADMIN" />
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6 modern-enter">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Form Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center space-x-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Edit Work Order Details</h3>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. DATE */}
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

                {/* 2. CLIENT */}
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

                {/* 3. PROJET */}
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

                {/* 4. WORK ORDER */}
                <div>
                  <label className={labelClass}>
                    <span className="text-indigo-600 font-bold mr-2">4)</span>WORK ORDER
                  </label>
                  <input
                    type="text"
                    value={workOrderNumber}
                    disabled
                    className={`${inputClass} bg-gray-100 text-gray-500`}
                  />
                </div>

                {/* 5. ITEM */}
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

                {/* 6. REFERENCE */}
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

                {/* 7. COLOR & WAY */}
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

                {/* 8. TYPE */}
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

                {/* 9. QUANTITY */}
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

                {/* 10. DESIGN N */}
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

                {/* 11. DELIVERY */}
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

                {/* STATUS */}
                <div>
                  <label className={labelClass}>
                    Status
                  </label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <AppDropdown
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        options={[
                          { value: 'PENDING', label: 'Pending' },
                          { value: 'IN_PROGRESS', label: 'In Progress' },
                          { value: 'COMPLETED', label: 'Completed' },
                          { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                        className={inputClass}
                      />
                    )}
                  />
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
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`/admin/workorders/${params.id}`)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}