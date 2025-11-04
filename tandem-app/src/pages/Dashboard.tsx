import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import type { Resource } from '../types';
import { ResourceTable } from '../components/ResourceTable';
import { BookingModal } from '../components/BookingModal';
import { Header } from '../components/Header';

export const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchResources();
      subscribeToChanges();
    }
  }, [user, authLoading]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      // Fetch resources with their current bookings
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .order('name');

      if (resourcesError) throw resourcesError;

      // Fetch active bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users(id, name, email, avatar_url)
        `)
        .is('released_at', null)
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
    setShowBookingModal(true);
  };

  const handleModalClose = () => {
    setShowBookingModal(false);
    setSelectedResource(null);
  };

  const handleBookingSuccess = () => {
    fetchResources();
    handleModalClose();
  };

  const filteredResources = resources.filter((resource) => {
    if (labelFilter === 'all') return true;
    return resource.labels?.split(',').map((l) => l.trim()).includes(labelFilter);
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="px-4 py-4 sm:px-0">
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

        {/* Resources Table */}
        <div className="px-4 sm:px-0">
          {filteredResources.length === 0 ? (
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

      {/* Booking Modal */}
      {showBookingModal && selectedResource && (
        <BookingModal
          resource={selectedResource}
          onClose={handleModalClose}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
};
