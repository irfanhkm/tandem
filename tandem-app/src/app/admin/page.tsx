'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Resource, ResourceFormData } from '@/types';
import { Header } from '@/components/Header';
import IntegrationSettings from '@/components/IntegrationSettings';
import { GCPCloudBuildIntegration } from '@/lib/gcpService';

export default function Admin() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState<ResourceFormData>({
    name: '',
    labels: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchResources();

    // Subscribe to realtime changes
    const resourcesChannel = supabase
      .channel('admin-resources-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        () => {
          fetchResources();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(resourcesChannel);
    };
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      setResources(data || []);
    } catch (err: any) {
      console.error('Error fetching resources:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Resource name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (editingResource) {
        // Update existing resource
        const { error: updateError } = await supabase
          .from('resources')
          .update({
            name: formData.name.trim(),
            labels: formData.labels?.trim() || null,
          })
          .eq('id', editingResource.id);

        if (updateError) throw updateError;
      } else {
        // Create new resource - let database handle timestamps with defaults
        const { error: insertError } = await supabase.from('resources').insert({
          name: formData.name.trim(),
          labels: formData.labels?.trim() || null,
        });

        if (insertError) throw insertError;
      }

      // Reset form and refresh list
      setFormData({ name: '', labels: '' });
      setShowForm(false);
      setEditingResource(null);
      fetchResources();
    } catch (err: any) {
      console.error('Error saving resource:', err);
      setError(err.message || 'Failed to save resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      name: resource.name,
      labels: resource.labels || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Are you sure you want to delete "${resource.name}"?`)) {
      return;
    }

    try {
      setError(null);

      // Check if resource has active bookings
      const { data: activeBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('resource_id', resource.id)
        .is('released_at', null)
        .is('deleted_at', null);

      if (bookingsError) throw bookingsError;

      if (activeBookings && activeBookings.length > 0) {
        setError('Cannot delete resource with active bookings. Release the booking first.');
        return;
      }

      // Soft delete resource (set deleted_at timestamp)
      const { error: deleteError } = await supabase
        .from('resources')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', resource.id);

      if (deleteError) throw deleteError;

      // Soft delete all associated bookings
      const { error: bookingDeleteError } = await supabase
        .from('bookings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('resource_id', resource.id)
        .is('deleted_at', null);

      if (bookingDeleteError) throw bookingDeleteError;

      // Log deletion to booking history for all deleted bookings
      const { data: deletedBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('resource_id', resource.id)
        .not('deleted_at', 'is', null);

      if (deletedBookings && deletedBookings.length > 0) {
        const historyEntries = deletedBookings.map(booking => ({
          booking_id: booking.id,
          action: 'DELETE',
          resource_id: booking.resource_id,
          booked_by: booking.booked_by,
          branch: booking.branch,
          notes: booking.notes,
          build_link: booking.build_link,
          expires_at: booking.expires_at,
          released_at: booking.released_at,
          timestamp: new Date().toISOString()
        }));

        await supabase.from('booking_history').insert(historyEntries);
      }

      fetchResources();
    } catch (err: any) {
      console.error('Error deleting resource:', err);
      setError(err.message || 'Failed to delete resource');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', labels: '' });
    setShowForm(false);
    setEditingResource(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel - Resources</h1>
            <div className="flex space-x-2">
              {!showForm && !showIntegrations && (
                <>
                  <button
                    onClick={() => setShowIntegrations(!showIntegrations)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    ⚙️ Integrations
                  </button>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    + Add Resource
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Integrations Section */}
          {showIntegrations && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">External Integrations</h2>
                  <p className="text-sm text-gray-600">
                    Connect external services to automatically sync resources
                  </p>
                </div>
                <button
                  onClick={() => setShowIntegrations(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-4">
                <IntegrationSettings
                  provider={GCPCloudBuildIntegration}
                  onSyncComplete={(result) => {
                    if (result.success > 0) {
                      fetchResources();
                    }
                  }}
                  onConfigChange={() => {
                    // Optionally refresh or update UI
                  }}
                />
                {/* Future integrations can be added here */}
                {/* <IntegrationSettings provider={AWSCodeBuildIntegration} /> */}
                {/* <IntegrationSettings provider={AzurePipelinesIntegration} /> */}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingResource ? 'Edit Resource' : 'Add New Resource'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Resource Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="e.g., op-order-service-qa-from-feature"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Full trigger name or environment identifier
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Labels</label>
                  <input
                    type="text"
                    value={formData.labels}
                    onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="e.g., qa, order-service, feature-branch"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Comma-separated tags for filtering
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingResource ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

              {/* Resources Table */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Resource Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Labels
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </td>
                      </tr>
                    ) : resources.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                          No resources found. Add your first resource!
                        </td>
                      </tr>
                    ) : (
                      resources.map((resource) => (
                        <tr key={resource.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            {resource.labels ? (
                              <div className="flex flex-wrap gap-1">
                                {resource.labels.split(',').map((label, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {label.trim()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">No labels</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(resource)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(resource)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
        </div>
      </main>
    </div>
  );
}
