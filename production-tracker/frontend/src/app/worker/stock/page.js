'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AppDropdown from '@/components/AppDropdown';
import api from '@/lib/axios';
import { confirmToast, notifyError, notifySuccess } from '@/lib/toast';
import {
  Boxes,
  Bolt,
  Package,
  Wrench,
  PackageCheck,
  Cog,
  CircleCheckBig,
  Search,
  Bookmark,
  Plus,
  X,
} from 'lucide-react';

const CATEGORIES = [
  {
    value: 'RAW_MATERIAL',
    label: 'Raw Material',
    color: 'bg-brown-100 text-brown-700',
    icon: <Boxes className="w-7 h-7 " />,
  },
  {
    value: 'COMPONENT',
    label: 'Component',
    color: 'bg-blue-100 text-blue-700',
    icon: <Bolt className="w-7 h-7 text-blue-600" />,
  },
  {
    value: 'FINISHED_PRODUCT',
    label: 'Finished Product',
    color: 'bg-green-100 text-green-700',
    icon: <PackageCheck className="w-7 h-7 text-green-700" />,
  },
  {
    value: 'TOOL',
    label: 'Tool',
    color: 'bg-gray-100 text-red-700',
    icon: <Wrench className="w-7 h-7 text-red-500" />,
  },
  {
    value: 'CONSUMABLE',
    label: 'Consumable',
    color: 'bg-orange-100 text-gray-700',
    icon: <Cog className="w-7 h-7 text-gray-600" />,
  },
];

const RESERVATION_STATUS = {
  RESERVED: { label: 'Reserved', color: 'bg-blue-100 text-blue-700' },
  CONSUMED: { label: 'Consumed', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export default function WorkerStockPage() {
  const router = useRouter();
  const [user] = useState(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'reservations'
  const [stockItems, setStockItems] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [myWorkOrders, setMyWorkOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [reserveFormData, setReserveFormData] = useState({
    workOrderId: '',
    quantity: 1,
    notes: '',
  });

  const fetchData = async () => {
    try {
      const [stockRes, reservationsRes, tasksRes] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/reservations/my-reservations'),
        api.get('/stages/my-tasks'),
      ]);

      setStockItems(stockRes.data.stockItems);
      setMyReservations(reservationsRes.data.reservations);

      // Extract unique work orders from tasks
      const workOrders = tasksRes.data.stages.map(s => s.workOrder);
      const uniqueWO = Array.from(
        new Map(workOrders.map(wo => [wo.id, wo])).values()
      );
      setMyWorkOrders(uniqueWO);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      notifyError('Failed to load data');
      setIsLoading(false);
    }
  };

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
    Promise.resolve().then(() => fetchData());
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const openReserveModal = (item) => {
    if (myWorkOrders.length === 0) {
      notifyError('You have no assigned work orders');
      return;
    }

    setSelectedStock(item);
    setReserveFormData({
      workOrderId: myWorkOrders[0]?.id || '',
      quantity: 1,
      notes: '',
    });
    setIsReserveModalOpen(true);
  };

  const closeReserveModal = () => {
    setIsReserveModalOpen(false);
    setSelectedStock(null);
    setReserveFormData({ workOrderId: '', quantity: 1, notes: '' });
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();

    if (!reserveFormData.workOrderId) {
      notifyError('Please select a work order');
      return;
    }

    try {
      await api.post('/stock/reserve', {
        stockItemId: selectedStock.id,
        workOrderId: parseInt(reserveFormData.workOrderId),
        quantity: parseInt(reserveFormData.quantity),
        notes: reserveFormData.notes,
      });

      notifySuccess(`Reserved ${reserveFormData.quantity} ${selectedStock.unit} successfully!`);
      await fetchData();
      setTimeout(() => closeReserveModal(), 1500);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Failed to reserve stock');
    }
  };

  const handleCancelReservation = async (reservationId, itemName) => {
    confirmToast({
      title: `Cancel reservation for "${itemName}"?`,
      description: 'Stock will be returned to inventory.',
      confirmLabel: 'Cancel Reservation',
      onConfirm: async () => {
        try {
          await api.patch(`/stock/reservations/${reservationId}/status`, {
            status: 'CANCELLED',
          });
          notifySuccess('Reservation cancelled successfully');
          await fetchData();
        } catch (error) {
          notifyError(error.response?.data?.error || 'Failed to cancel reservation');
        }
      },
    });
  };

  const handleMarkConsumed = async (reservationId, itemName) => {
    confirmToast({
      title: `Mark "${itemName}" as consumed?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Mark Consumed',
      onConfirm: async () => {
        try {
          await api.patch(`/stock/reservations/${reservationId}/status`, {
            status: 'CONSUMED',
          });
          notifySuccess('Marked as consumed successfully');
          await fetchData();
        } catch (error) {
          notifyError(error.response?.data?.error || 'Failed to update status');
        }
      },
    });
  };

  const filteredStock = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryConfig = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stock & Materials</h1>
              <p className="text-gray-600 mt-1">View available stock and manage your reservations</p>
            </div>
            <NotificationBell role="WORKER" />
          </div>
        </header>

        <main className="p-4 sm:p-8 modern-enter">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 modern-hover">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('stock')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                  activeTab === 'stock'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Available Stock
                </span>
              </button>
              <button
                onClick={() => setActiveTab('reservations')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition relative ${
                  activeTab === 'reservations'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  My Reservations
                </span>
                {myReservations.filter(r => r.status === 'RESERVED').length > 0 && (
                  <span className="ml-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {myReservations.filter(r => r.status === 'RESERVED').length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Stock Tab */}
          {activeTab === 'stock' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Items</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stockItems.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
                  <p className="text-xs text-gray-500 font-medium uppercase">My Reservations</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {myReservations.filter(r => r.status === 'RESERVED').length}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 modern-hover">
                  <p className="text-xs text-gray-500 font-medium uppercase">Low Stock</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {stockItems.filter(s => s.isLowStock).length}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 modern-hover">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-48 relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <AppDropdown
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                    options={[
                      { value: 'ALL', label: 'All Categories' },
                      ...CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
                    ]}
                    className="px-4 py-2 text-sm"
                    containerClassName="min-w-40"
                  />
                </div>
              </div>

              {/* Stock Items Grid */}
              {filteredStock.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center modern-hover">
                  <Package className="w-14 h-14 mb-4 mx-auto text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Stock Items Found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStock.map(item => {
                    const catConfig = getCategoryConfig(item.category);
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition modern-hover"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <span>{catConfig.icon}</span>
                              <div>
                                <h3 className="font-bold text-gray-900">{item.name}</h3>
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${catConfig.color}`}>
                                  {catConfig.label}
                                </span>
                              </div>
                            </div>
                            {item.isLowStock && (
                              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                                Low
                              </span>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                          )}

                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Available:</span>
                              <span className="font-bold text-gray-900">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                            {item.location && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Location:</span>
                                <span className="font-medium text-gray-700">{item.location}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Min. Level:</span>
                              <span className="text-gray-700">{item.minQuantity} {item.unit}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => openReserveModal(item)}
                            disabled={item.quantity === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 modern-hover "
                          >
                            <Plus className="w-4 h-4" />
                            <span>{item.quantity === 0 ? 'Out of Stock' : 'Reserve'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Reservations Tab */}
          {activeTab === 'reservations' && (
            <>
              {myReservations.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center modern-hover">
                  <Bookmark className="w-14 h-14 mb-4 mx-auto text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Reservations Yet</h3>
                  <p className="text-gray-500 mb-6">Reserve materials from the Stock tab</p>
                  <button
                    onClick={() => setActiveTab('stock')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg transition font-medium modern-hover modern-pulse"
                  >
                    Browse Stock
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myReservations.map(reservation => {
                    const statusConfig = RESERVATION_STATUS[reservation.status];
                    const catConfig = getCategoryConfig(reservation.stockItem.category);
                    return (
                      <div
                        key={reservation.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 modern-hover"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            <span>{catConfig.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="font-bold text-gray-900">{reservation.stockItem.name}</h3>
                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.color}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500">Work Order:</span>
                                  <p className="font-mono font-semibold text-indigo-600">
                                    {reservation.workOrder.workOrderNumber}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Quantity:</span>
                                  <p className="font-bold text-gray-900">
                                    {reservation.quantity} {reservation.stockItem.unit}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Client:</span>
                                  <p className="text-gray-700">{reservation.workOrder.client}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Reserved:</span>
                                  <p className="text-gray-700">
                                    {new Date(reservation.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              {reservation.notes && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                                  <p className="text-yellow-800">
                                    <strong>Note:</strong> {reservation.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {reservation.status === 'RESERVED' && (
                            <div className="flex flex-col space-y-2 ml-4">
                              <button
                                onClick={() => handleMarkConsumed(reservation.id, reservation.stockItem.name)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2"
                              >
                                <CircleCheckBig className="w-4 h-4" />
                                Mark Consumed
                              </button>
                              <button
                                onClick={() => handleCancelReservation(reservation.id, reservation.stockItem.name)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Reserve Modal */}
      {isReserveModalOpen && selectedStock && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reserve Stock</h3>
              <button onClick={closeReserveModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleReserveSubmit} className="p-6 space-y-4">
              {/* Item Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <span>{getCategoryConfig(selectedStock.category).icon}</span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{selectedStock.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Available: {selectedStock.quantity} {selectedStock.unit}
                    </p>
                  </div>
                </div>
              </div>

              {/* Work Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Work Order <span className="text-red-500">*</span>
                </label>
                <AppDropdown
                  value={reserveFormData.workOrderId}
                  onValueChange={(workOrderId) =>
                    setReserveFormData({ ...reserveFormData, workOrderId })
                  }
                  options={[
                    { value: '', label: 'Select work order' },
                    ...myWorkOrders.map((wo) => ({
                      value: String(wo.id),
                      label: `${wo.workOrderNumber} - ${wo.client}`,
                    })),
                  ]}
                  className="w-full px-4 py-2"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity ({selectedStock.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedStock.quantity}
                  value={reserveFormData.quantity}
                  onChange={(e) => setReserveFormData({ ...reserveFormData, quantity: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={reserveFormData.notes}
                  onChange={(e) => setReserveFormData({ ...reserveFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={closeReserveModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  Reserve Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}