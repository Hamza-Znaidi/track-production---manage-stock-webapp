'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import AppDropdown from '@/components/AppDropdown';
import api from '@/lib/axios';
import { confirmToast, notifyError, notifySuccess } from '@/lib/toast';

const SUB_ROLES = [
  { value: 'SALES', label: 'Sales' },
  { value: 'CAD', label: 'CAD' },
  { value: 'CAM', label: 'CAM' },
  { value: 'STORE', label: 'Store' },
  { value: 'CNC', label: 'CNC' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'DELIVERY', label: 'Delivery' },
];

const SUB_ROLE_COLORS = {
  SALES:    'bg-blue-100 text-blue-800',
  CAD:      'bg-pink-100 text-pink-800',
  CAM:      'bg-yellow-100 text-yellow-800',
  STORE:    'bg-orange-100 text-orange-800',
  CNC:      'bg-cyan-100 text-cyan-800',
  ASSEMBLY: 'bg-green-100 text-green-800',
  QUALITY:  'bg-purple-100 text-purple-800',
  DELIVERY: 'bg-red-100 text-red-800',
};
export default function WorkersManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'WORKER',
    subRoles: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    fetchWorkers();
  }, [router]);

  const fetchWorkers = async () => {
    try {
      const response = await api.get('/auth/users');
      setWorkers(response.data.users);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching workers:', error);
      notifyError('Failed to load workers');
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ username: '', password: '', role: 'WORKER', subRoles: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (worker) => {
    setModalMode('edit');
    setSelectedWorker(worker);
    setFormData({
      username: worker.username,
      password: '',
      role: worker.role,
      subRoles: worker.subRoles || [],
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ username: '', password: '', role: 'WORKER', subRoles: [] });
    setSelectedWorker(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If role changes to ADMIN, clear sub-roles
    if (name === 'role' && value === 'ADMIN') {
      setFormData({ ...formData, role: value, subRoles: [] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Handle checkbox toggle for sub-roles
  const handleSubRoleToggle = (subRoleValue) => {
    const current = formData.subRoles;
    const isSelected = current.includes(subRoleValue);

    if (isSelected) {
      // Remove it
      setFormData({
        ...formData,
        subRoles: current.filter((sr) => sr !== subRoleValue),
      });
    } else {
      // Add it
      setFormData({
        ...formData,
        subRoles: [...current, subRoleValue],
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation
    if (formData.role === 'WORKER' && formData.subRoles.length === 0) {
      notifyError('Please select at least one sub-role for the worker');
      return;
    }

    setIsSubmitting(true);

    try {
      if (modalMode === 'create') {
        await api.post('/auth/register', formData);
        notifySuccess('Worker created successfully!');
        await fetchWorkers();
        setTimeout(() => closeModal(), 1500);
      } else {
        const updateData = {
          username: formData.username,
          role: formData.role,
          subRoles: formData.subRoles,
        };
        if (formData.password.trim() !== '') {
          updateData.password = formData.password;
        }
        await api.put(`/auth/users/${selectedWorker.id}`, updateData);
        notifySuccess('Worker updated successfully!');
        await fetchWorkers();
        setTimeout(() => closeModal(), 1500);
      }
    } catch (error) {
      notifyError(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (workerId, username) => {
    confirmToast({
      title: `Delete "${username}"?`,
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/auth/users/${workerId}`);
          notifySuccess(`User "${username}" deleted successfully!`);
          await fetchWorkers();
        } catch (error) {
          notifyError(error.response?.data?.error || 'Failed to delete user');
        }
      },
    });
  };

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
          <div className="px-4 sm:px-8 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Worker Management</h1>
              <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell role="ADMIN" />
              <button
                onClick={openCreateModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Worker</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-8 modern-enter">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{workers.length}</p>
                </div>
                <div className="bg-blue-50 rounded-full p-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Admins</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {workers.filter((w) => w.role === 'ADMIN').length}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-full p-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Workers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {workers.filter((w) => w.role === 'WORKER').length}
                  </p>
                </div>
                <div className="bg-green-50 rounded-full p-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sub-Roles</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-gray-50 transition">
                      {/* User */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {worker.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-900">{worker.username}</p>
                            <p className="text-xs text-gray-500">ID: {worker.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          worker.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {worker.role}
                        </span>
                      </td>

                      {/* Sub-Roles */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {worker.subRoles && worker.subRoles.length > 0 ? (
                            worker.subRoles.map((sr) => {
                              const label = SUB_ROLES.find((s) => s.value === sr)?.label || sr;
                              const color = SUB_ROLE_COLORS[sr] || 'bg-gray-100 text-gray-800';
                              return (
                                <span key={sr} className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${color}`}>
                                  {label}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-gray-400 italic">No sub-roles</span>
                          )}
                        </div>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(worker.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(worker)}
                            className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(worker.id, worker.username)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                            title="Delete"
                            disabled={worker.id === user?.id}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {modalMode === 'create' ? '➕ Add New User' : '✏️ Edit User'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Enter username"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password {modalMode === 'edit' && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Enter password"
                  required={modalMode === 'create'}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                <AppDropdown
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  options={[
                    { value: 'WORKER', label: 'Worker' },
                    { value: 'ADMIN', label: 'Admin' },
                  ]}
                  className="w-full px-4 py-2"
                />
              </div>

              {/* Sub-Roles — Only visible when role is WORKER */}
              {formData.role === 'WORKER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Sub-Roles
                    <span className="text-red-500 ml-1">*</span>
                    <span className="text-gray-400 font-normal ml-2">(select at least one)</span>
                  </label>
                  <div className="space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    {SUB_ROLES.map((subRole) => {
                      const isChecked = formData.subRoles.includes(subRole.value);
                      return (
                        <label
                          key={subRole.value}
                          className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition ${
                            isChecked ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-white dark:hover:bg-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSubRoleToggle(subRole.value)}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className={`text-sm font-medium ${isChecked ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                            {subRole.label}
                          </span>
                          {isChecked && (
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${SUB_ROLE_COLORS[subRole.value]}`}>
                              Selected
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {/* Show selected count */}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {formData.subRoles.length === 0 ? (
                      <span className="text-red-500 dark:text-red-400">⚠️ No sub-roles selected</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">✅ {formData.subRoles.length} sub-role{formData.subRoles.length > 1 ? 's' : ''} selected</span>
                    )}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : modalMode === 'create'
                    ? 'Create User'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}