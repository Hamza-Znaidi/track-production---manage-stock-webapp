'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import { Factory, Cpu, PackageCheck ,PackageX, Container,MessageSquareShare,Bolt,Boxes, Ticket , DiamondPlus,SquarePen, Cog,BookmarkX} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AppDropdown from '@/components/AppDropdown';
import api from '@/lib/axios';
import { Wrench } from 'lucide-react';
import { confirmToast, notifyError, notifySuccess, promptNumberToast } from '@/lib/toast';

const CATEGORIES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material', color: 'bg-brown-100 text-brown-700', icon: <Boxes className="w-7 h-7 " /> },
  { value: 'COMPONENT', label: 'Component', color: 'bg-blue-100 text-blue-700', icon: <Bolt className="w-7 h-7 text-blue-600" /> },
  { value: 'FINISHED_PRODUCT', label: 'Finished Product', color: 'bg-green-100 text-green-700', icon: <PackageCheck className="w-7 h-7 text-green-700" /> },
  { value: 'TOOL', label: 'Tool', color: 'bg-gray-100 text-gray-700', icon: <Wrench className="w-7 h-7 text-red-500" /> },
  { value: 'CONSUMABLE', label: 'Consumable', color: 'bg-orange-100 text-orange-700', icon: <Cog className="w-7 h-7 text-gray-500" />},
];

const RESERVATION_STATUS = {
  RESERVED: { label: 'Reserved', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  CONSUMED: { label: 'Consumed', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function AdminStockPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'reservations'
  const [stockItems, setStockItems] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'RAW_MATERIAL',
    quantity: 0,
    unit: '',
    minQuantity: 10,
    location: '',
    supplier: '',
    price: '',
    notes: '',
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
    setUser(currentUser);
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const [stockRes, reservationsRes] = await Promise.all([
        api.get('/stock'),
        api.get('/stock/reservations'),
      ]);

      setStockItems(stockRes.data.stockItems);
      setReservations(reservationsRes.data.reservations);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      notifyError('Failed to load data');
      setIsLoading(false);
    }
  };

  const fetchStockItems = async () => {
    try {
      const params = {};
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (lowStockFilter) params.lowStock = 'true';
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/stock', { params });
      setStockItems(response.data.stockItems);
    } catch (error) {
      console.error('Error fetching stock:', error);
      notifyError('Failed to load stock items');
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      name: '',
      description: '',
      category: 'RAW_MATERIAL',
      quantity: 0,
      unit: '',
      minQuantity: 10,
      location: '',
      supplier: '',
      price: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minQuantity: item.minQuantity,
      location: item.location || '',
      supplier: item.supplier || '',
      price: item.price || '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setFormData({
      name: '',
      description: '',
      category: 'RAW_MATERIAL',
      quantity: 0,
      unit: '',
      minQuantity: 10,
      location: '',
      supplier: '',
      price: '',
      notes: '',
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await api.post('/stock', formData);
        notifySuccess('Stock item created successfully!');
      } else {
        await api.put(`/stock/${selectedItem.id}`, formData);
        notifySuccess('Stock item updated successfully!');
      }
      await fetchData();
      setTimeout(() => closeModal(), 1500);
    } catch (error) {
      notifyError(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    confirmToast({
      title: `Delete "${name}"?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/stock/${id}`);
          notifySuccess(`"${name}" deleted successfully`);
          await fetchData();
        } catch (error) {
          notifyError('Failed to delete item');
        }
      },
    });
  };

  const handleQuickAdjust = async (id, name, currentQty) => {
    promptNumberToast({
      title: `Adjust quantity for "${name}"`,
      description: `Current: ${currentQty}. Enter a positive or negative number.`,
      defaultValue: '+10',
      confirmLabel: 'Apply',
      onInvalid: () => notifyError('Invalid number'),
      onConfirm: async (value) => {
        try {
          await api.patch(`/stock/${id}/quantity`, { adjustment: value });
          notifySuccess(`Quantity adjusted by ${value > 0 ? '+' : ''}${value}`);
          await fetchData();
        } catch (error) {
          notifyError(error.response?.data?.error || 'Failed to adjust quantity');
        }
      },
    });
  };

  const handleCancelReservation = async (reservationId, itemName) => {
    confirmToast({
      title: `Cancel reservation for "${itemName}"?`,
      description: 'Stock will be returned.',
      confirmLabel: 'Cancel Reservation',
      onConfirm: async () => {
        try {
          await api.patch(`/stock/reservations/${reservationId}/status`, {
            status: 'CANCELLED',
          });
          notifySuccess('Reservation cancelled');
          await fetchData();
        } catch (error) {
          notifyError('Failed to cancel reservation');
        }
      },
    });
  };

  useEffect(() => {
    if (!isLoading && activeTab === 'stock') fetchStockItems();
  }, [categoryFilter, lowStockFilter, searchQuery]);

  const filteredItems = stockItems;
  const lowStockCount = stockItems.filter(item => item.isLowStock).length;
  const totalValue = stockItems.reduce((sum, item) => 
    sum + (item.quantity * (item.price || 0)), 0
  );
  const activeReservations = reservations.filter(r => r.status === 'RESERVED').length;
  const consumedReservations = reservations.filter(r => r.status === 'CONSUMED').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const getCategoryConfig = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar role="ADMIN" onLogout={handleLogout} />

      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm mt-8 sm:mt-0">
          <div className="px-3 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Stock Management</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {stockItems.length} items • {activeReservations} active reservations
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <NotificationBell role="ADMIN" />
              <button
                onClick={openCreateModal}
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg flex items-center justify-center sm:justify-start space-x-2 transition shadow-sm font-medium text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Stock Item</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-8 space-y-4 sm:space-y-6 modern-enter">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 overflow-x-auto">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('stock')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  activeTab === 'stock'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Boxes className='inline w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2' /> <span className="hidden sm:inline">Stock Items</span><span className="sm:hidden">Stock</span>
              </button>
              <button
                onClick={() => setActiveTab('reservations')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition relative whitespace-nowrap ${
                  activeTab === 'reservations'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Ticket className="w-4 h-4 mr-1 sm:mr-2 inline" /> <span className="hidden sm:inline">All Reservations</span><span className="sm:hidden">Reservations</span>
                {activeReservations > 0 && (
                  <span className="ml-1 sm:ml-2 bg-indigo-600 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {activeReservations}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Stock Tab */}
          {activeTab === 'stock' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Items</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stockItems.length}</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Low Stock</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">{lowStockCount}</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Categories</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1 sm:mt-2">{CATEGORIES.length}</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total Value</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1 sm:mt-2">${totalValue.toFixed(0)}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  {/* Search */}
                  <div className="flex-1 min-w-48 relative">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm"
                    />
                  </div>

                  {/* Category Filter */}
                  <AppDropdown
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                    options={[
                      { value: 'ALL', label: 'All Categories' },
                      ...CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
                    ]}
                    className="px-3 sm:px-4 py-2 text-xs sm:text-sm"
                    containerClassName="min-w-40"
                  />

                  {/* Low Stock Toggle */}
                  <label className="flex items-center space-x-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={lowStockFilter}
                      onChange={(e) => setLowStockFilter(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 hidden sm:inline">Low Stock Only</span>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 sm:hidden">Low</span>
                  </label>
                </div>
              </div>

              {/* Stock Items Table */}
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-16 text-center">
                  <div className="text-4xl sm:text-6xl mb-3 sm:mb-4"><PackageX className='w-14 h-14 mb-4 mx-auto'/></div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Stock Items Found</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
                    {searchQuery || categoryFilter !== 'ALL' || lowStockFilter
                      ? 'Try adjusting your filters'
                      : 'Add your first stock item to get started'}
                  </p>
                  {!searchQuery && categoryFilter === 'ALL' && !lowStockFilter && (
                    <button
                      onClick={openCreateModal}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg transition font-medium text-sm sm:text-base"
                    >
                      Add Stock Item
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Name', 'Category', 'Quantity', 'Location', 'Price', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredItems.map(item => {
                        const catConfig = getCategoryConfig(item.category);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition">
                            {/* Name */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="flex items-center space-x-2">
                                <span className="text-xl hidden sm:inline">{catConfig.icon}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">{item.name}</p>
                                  {item.code && (
                                    <p className="text-xs font-mono text-indigo-600 truncate">{item.code}</p>
                                  )}
                                  {item.description && (
                                    <p className="text-xs text-gray-500 truncate max-w-xs hidden sm:block">{item.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                              <span className={`inline-flex px-2 sm:px-3 py-1 text-xs font-semibold rounded-full ${catConfig.color}`}>
                                {catConfig.label}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <div>
                                  <p className="font-bold text-gray-900 text-xs sm:text-base">{item.quantity}</p>
                                  <p className="text-xs text-gray-500 hidden sm:block">{item.unit}</p>
                                </div>
                                <button
                                  onClick={() => handleQuickAdjust(item.id, item.name, item.quantity)}
                                  className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded transition flex-shrink-0"
                                  title="Quick Adjust"
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </button>
                              </div>
                            </td>

                            {/* Location */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden md:table-cell">
                              {item.location || '—'}
                            </td>

                            {/* Price */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 hidden lg:table-cell">
                              {item.price ? `$${item.price.toFixed(2)}` : '—'}
                            </td>

                            {/* Status */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                              {item.isLowStock ? (
                                <span className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  <span>Low</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>OK</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                                  title="Edit"
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id, item.name)}
                                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                                  title="Delete"
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              )}
            </>
          )}

          {/* Reservations Tab */}
          {activeTab === 'reservations' && (
            <>
              {/* Reservation Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Active</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1 sm:mt-2">{activeReservations}</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Consumed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1 sm:mt-2">{consumedReservations}</p>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-5 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase">Total</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{reservations.length}</p>
                </div>
              </div>

              {/* Reservations List */}
              {reservations.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-16 text-center">
                  <div className="text-4xl sm:text-6xl mb-3 sm:mb-4"><BookmarkX className="w-16 h-16 mx-auto" /></div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Reservations Yet</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Workers can reserve stock for their work orders</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Item', 'Work Order', 'Worker', 'Quantity', 'Status', 'Reserved', 'Actions'].map(h => (
                          <th key={h} className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reservations.map(res => {
                        const statusConfig = RESERVATION_STATUS[res.status];
                        const catConfig = getCategoryConfig(res.stockItem.category);
                        return (
                          <tr key={res.id} className="hover:bg-gray-50 transition">
                            {/* Item */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                                <span className="text-lg hidden sm:inline">{catConfig.icon}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{res.stockItem.name}</p>
                                  <p className="text-xs text-gray-500 hidden sm:block">{catConfig.label}</p>
                                </div>
                              </div>
                            </td>

                            {/* Work Order */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                              <p className="font-mono font-semibold text-indigo-600 text-xs sm:text-sm truncate">
                                {res.workOrder.workOrderNumber}
                              </p>
                              <p className="text-xs text-gray-500">{res.workOrder.client}</p>
                            </td>

                            {/* Worker */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-700 hidden md:table-cell">
                              {res.reservedBy.username}
                            </td>

                            {/* Quantity */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <p className="font-bold text-gray-900 text-xs sm:text-sm">
                                {res.quantity} <span className="hidden sm:inline">{res.stockItem.unit}</span>
                              </p>
                            </td>

                            {/* Status */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <span className={`inline-flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                                <span className="hidden sm:inline">{statusConfig.label}</span>
                                <span className="sm:hidden">{statusConfig.label.substring(0, 3)}</span>
                              </span>
                            </td>

                            {/* Reserved Date */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 hidden lg:table-cell">
                              {new Date(res.createdAt).toLocaleDateString()}
                            </td>

                            {/* Actions */}
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              {res.status === 'RESERVED' && (
                                <button
                                  onClick={() => handleCancelReservation(res.id, res.stockItem.name)}
                                  className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition text-xs font-medium whitespace-nowrap"
                                  title="Cancel"
                                >
                                  <span className="hidden sm:inline">Cancel</span>
                                  <span className="sm:hidden">✕</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl sm:max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                {modalMode === 'create' ? <span className="flex items-center gap-2"><DiamondPlus className="w-5 h-5" /> Add Stock Item</span> : <span className="flex items-center gap-2"><SquarePen className="w-5 h-5" /> Edit Stock Item</span>}
              </h3>
              <button onClick={closeModal} aria-label="Close modal" className="p-1.5 sm:p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g., Steel Rod, Circuit Board"
                  />
                </div>

                {modalMode === 'edit' && selectedItem?.code && (
                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stock Code
                    </label>
                    <input
                      type="text"
                      value={selectedItem.code}
                      readOnly
                      className="w-full px-3 sm:px-4 py-2 border border-gray-200 bg-gray-50 text-gray-700 rounded-lg text-sm font-mono"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <AppDropdown
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    options={CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label }))}
                    className="w-full px-3 sm:px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="pieces, kg, meters..."
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Min Quantity (Alert Threshold)
                  </label>
                  <input
                    type="number"
                    name="minQuantity"
                    value={formData.minQuantity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Storage Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Warehouse A, Shelf B3..."
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Supplier</label>
                  <input
                    type="text"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleInputChange}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Supplier name..."
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit Price ($)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:bg-indigo-400 text-sm"
                >
                  {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}