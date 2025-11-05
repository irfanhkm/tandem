import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { Resource } from '../types';
import { ResourceTable } from '../components/ResourceTable';
import { BookingForm } from '../components/BookingForm';
import { Header } from '../components/Header';

export const Dashboard = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);

  useEffect(() => {
    fetchResources();
    subscribeToChanges();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      // Fetch resources with their current bookings (exclude soft-deleted)
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (resourcesError) throw resourcesError;

      // Fetch active bookings (no user join, just booked_by name, exclude soft-deleted)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .is('released_at', null)
        .is('deleted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (bookingsError) throw bookingsError;

      // Combine resources with their bookings
      const resourcesWithBookings = resourcesData?.map((resource) => {
        const booking = bookingsData?.find((b) => b.resource_id === resource.id);
        return {
          ...resource,
          current_booking: booking || undefined,
          status: booking ? 'LOCKED' : 'FREE',
        } as Resource;
      }) || [];

      setResources(resourcesWithBookings);

      // Extract unique labels
      const labels = new Set<string>();
      resourcesData?.forEach((resource) => {
        if (resource.labels) {
          resource.labels.split(',').forEach((label: string) => {
            labels.add(label.trim());
          });
        }
      });
      setAvailableLabels(Array.from(labels));
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    // Subscribe to changes in bookings table
    const bookingsChannel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchResources();
        }
      )
      .subscribe();

    // Subscribe to changes in resources table
    const resourcesChannel = supabase
      .channel('resources-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        () => {
          fetchResources();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(resourcesChannel);
    };
  };

  const handleResourceClick = (resource: Resource) => {
    setSelectedResource(resource);
  };

  const handleFormClose = () => {
    setSelectedResource(null);
  };

  const handleBookingSuccess = () => {
    fetchResources();
    handleFormClose();
  };

  const filteredResources = resources.filter((resource) => {
    if (labelFilter === 'all') return true;
    return resource.labels?.split(',').map((l) => l.trim()).includes(labelFilter);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Filters */}
          <div className="py-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by label:</label>
              <select
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                {availableLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Booking Form - Inline */}
          {selectedResource && (
            <BookingForm
              resource={selectedResource}
              onClose={handleFormClose}
              onSuccess={handleBookingSuccess}
            />
          )}

          {/* Resources Table */}
          {loading ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500">No resources found.</p>
            </div>
          ) : (
            <ResourceTable
              resources={filteredResources}
              onResourceClick={handleResourceClick}
            />
          )}
        </div>
      </main>
    </div>
  );
};
