'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AppDropdown from '@/components/AppDropdown';
import QRScannerModal from '@/components/QRScannerModal';
import api from '@/lib/axios';
import { confirmToast, notifyError, notifySuccess } from '@/lib/toast';
import { QrCode,ClipboardX } from 'lucide-react';

// Status badge config
const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  async function fetchWorkOrders() {
    try {
      const response = await api.get('/workorders');
      setWorkOrders(response.data.workOrders);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      notifyError('Failed to load work orders');
      setIsLoading(false);
    }
  }

  const handleDelete = async (id, workOrderNumber) => {
    confirmToast({
      title: `Delete ${workOrderNumber}?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/workorders/${id}`);
          notifySuccess(`${workOrderNumber} deleted successfully`);
          await fetchWorkOrders();
        } catch (error) {
          notifyError('Failed to delete work order');
        }
      },
    });
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const handleScannedCode = async (rawValue) => {
    const scannedValue = (rawValue || '').trim();
    setIsScannerOpen(false);

    if (!scannedValue) {
      notifyError('Scanned QR code is empty');
      return;
    }

    setSearchQuery(scannedValue);

    const exactMatch = workOrders.find(
      (workOrder) => workOrder.workOrderNumber?.toLowerCase() === scannedValue.toLowerCase()
    );

    if (exactMatch) {
      notifySuccess(`Found ${exactMatch.workOrderNumber}`);
      router.push(`/admin/workorders/${exactMatch.id}`);
      return;
    }

    try {
      const response = await api.get(`/workorders/lookup/${encodeURIComponent(scannedValue)}`);
      const workOrderId = response.data?.workOrderId;
      if (workOrderId) {
        notifySuccess(`Found ${response.data?.workOrderNumber || scannedValue}`);
        router.push(`/admin/workorders/${workOrderId}`);
        return;
      }
    } catch (lookupError) {
      notifyError('No matching work order found from this QR code');
    }
  };

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWorkOrders();
  }, [router]);

  // Filter work orders
  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.project.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <div className="px-4 sm:px-8 py-6 flex flex-wrap gap-4 justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Work Orders</h1>
              <p className="text-gray-600 mt-1">
                {workOrders.length} total work orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell role="ADMIN" />
              <button
                onClick={() => router.push('/admin/workorders/new')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center space-x-2 transition shadow-sm font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Work Order</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-8 modern-enter">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: workOrders.length, color: 'text-gray-900', bg: 'bg-white' },
              { label: 'Pending', value: workOrders.filter(w => w.status === 'PENDING').length, color: 'text-gray-600', bg: 'bg-white' },
              { label: 'In Progress', value: workOrders.filter(w => w.status === 'IN_PROGRESS').length, color: 'text-blue-600', bg: 'bg-white' },
              { label: 'Completed', value: workOrders.filter(w => w.status === 'COMPLETED').length, color: 'text-green-600', bg: 'bg-white' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-xl shadow-sm p-5 border border-gray-100`}>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-48 relative">
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by WO#, client, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              />
            </div>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-indigo-700 transition inline-flex items-center gap-2 text-sm font-medium"
              title="Scan work order QR"
            >
              <QrCode className="w-4 h-4" />
              Scan
            </button>

            {/* Status Filter */}
            <AppDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              className="px-4 py-2 text-sm"
              containerClassName="min-w-44"
            />
          </div>

          {/* Work Orders Table */}
          {filteredWorkOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
              <div className="text-6xl mb-4"><ClipboardX className='w-14 h-14 mb-4 mt-10 mx-auto '/> </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Work Orders Found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try adjusting your search or filter'
                  : 'Create your first work order to get started'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <button
                  onClick={() => router.push('/admin/workorders/new')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg transition font-medium"
                >
                  Create Work Order
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['WO Number', 'Client', 'Project', 'Item', 'Qty', 'Delivery', 'Status', 'Progress', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWorkOrders.map((wo) => {
                      const statusConfig = STATUS_CONFIG[wo.status] || STATUS_CONFIG.PENDING;
                      return (
                        <tr
                          key={wo.id}
                          className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => router.push(`/admin/workorders/${wo.id}`)}
                        >
                          {/* WO Number */}
                          <td className="px-4 py-4">
                            <span className="font-mono font-semibold text-indigo-600 text-sm">
                              {wo.workOrderNumber}
                            </span>
                          </td>

                          {/* Client */}
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {wo.client}
                          </td>

                          {/* Project */}
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {wo.project}
                          </td>

                          {/* Item */}
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {wo.item}
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-4 text-sm text-gray-600 font-medium">
                            {wo.quantity}
                          </td>

                          {/* Delivery */}
                          <td className="px-4 py-4">
                            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                              {wo.deliveryWeek}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                              <span>{statusConfig.label}</span>
                            </span>
                          </td>

                          {/* Progress */}
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full transition-all"
                                  style={{ width: `${wo.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 font-medium w-8">
                                {wo.progress}%
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => router.push(`/admin/workorders/${wo.id}`)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="View Details"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => router.push(`/admin/workorders/${wo.id}/edit`)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(wo.id, wo.workOrderNumber)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScannedCode}
        title="Scan Work Order"
      />
    </div>
  );
}