'use client';

import { useState } from 'react';
import type { Resource } from '../types';
import { supabase } from '../lib/supabase';
import { getExpiryPresets, formatDateTime } from '../utils/dateUtils';
import { addHours } from 'date-fns';

interface BookingFormProps {
  resource: Resource;
  onClose: () => void;
  onSuccess: () => void;
}

type FormMode = 'view' | 'book' | 'extend' | 'edit';

export const BookingForm = ({ resource, onClose, onSuccess }: BookingFormProps) => {
  const [mode, setMode] = useState<FormMode>(resource.status === 'FREE' ? 'book' : 'view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [bookedBy, setBookedBy] = useState(resource.current_booking?.booked_by || '');
  const [branch, setBranch] = useState(resource.current_booking?.branch || '');
  const [notes, setNotes] = useState(resource.current_booking?.notes || '');
  const [buildLink, setBuildLink] = useState(resource.current_booking?.build_link || '');
  const [expiresAt, setExpiresAt] = useState<Date>(
    resource.current_booking?.expires_at
      ? new Date(resource.current_booking.expires_at)
      : addHours(new Date(), 4)
  );

  const presets = getExpiryPresets();

  const handleBook = async () => {
    if (!bookedBy.trim()) {
      setError('Your name is required');
      return;
    }

    if (!branch.trim()) {
      setError('Branch name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create booking - let database handle created_at with default
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          resource_id: resource.id,
          booked_by: bookedBy.trim(),
          branch: branch.trim(),
          notes: notes.trim() || null,
          build_link: buildLink.trim() || null,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Log to history
      await supabase.from('booking_history').insert({
        booking_id: booking.id,
        action: 'BOOK',
        resource_id: resource.id,
        booked_by: bookedBy.trim(),
        branch: branch.trim(),
        notes: notes.trim() || null,
        build_link: buildLink.trim() || null,
        expires_at: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!resource.current_booking) return;

    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Update booking
      await supabase
        .from('bookings')
        .update({ released_at: now })
        .eq('id', resource.current_booking.id);

      // Log to history
      await supabase.from('booking_history').insert({
        booking_id: resource.current_booking.id,
        action: 'RELEASE',
        resource_id: resource.id,
        booked_by: resource.current_booking.booked_by,
        branch: resource.current_booking.branch,
        notes: resource.current_booking.notes || null,
        build_link: resource.current_booking.build_link || null,
        expires_at: resource.current_booking.expires_at,
        released_at: now,
        timestamp: now,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error releasing booking:', err);
      setError(err.message || 'Failed to release booking');
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!resource.current_booking) return;

    try {
      setLoading(true);
      setError(null);

      // Update booking
      await supabase
        .from('bookings')
        .update({ expires_at: expiresAt.toISOString() })
        .eq('id', resource.current_booking.id);

      // Log to history
      await supabase.from('booking_history').insert({
        booking_id: resource.current_booking.id,
        action: 'EXTEND',
        resource_id: resource.id,
        booked_by: resource.current_booking.booked_by,
        branch: resource.current_booking.branch,
        notes: resource.current_booking.notes || null,
        build_link: resource.current_booking.build_link || null,
        expires_at: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error extending booking:', err);
      setError(err.message || 'Failed to extend booking');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!resource.current_booking) return;

    if (!branch.trim()) {
      setError('Branch name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Update booking
      await supabase
        .from('bookings')
        .update({
          branch: branch.trim(),
          notes: notes.trim() || null,
          build_link: buildLink.trim() || null,
        })
        .eq('id', resource.current_booking.id);

      // Log to history
      await supabase.from('booking_history').insert({
        booking_id: resource.current_booking.id,
        action: 'EDIT',
        resource_id: resource.id,
        booked_by: resource.current_booking.booked_by,
        branch: branch.trim(),
        notes: notes.trim() || null,
        build_link: buildLink.trim() || null,
        expires_at: resource.current_booking.expires_at,
        timestamp: new Date().toISOString(),
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error editing booking:', err);
      setError(err.message || 'Failed to edit booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div>
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {resource.name}
              </h3>
              {resource.labels && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {resource.labels.split(',').map((label, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {label.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {mode === 'view' && (
                <button
                  onClick={() => setMode('edit')}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                  title="Edit Details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              <button
                onClick={mode === 'view' ? onClose : mode === 'book' ? onClose : () => setMode('view')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* View Mode */}
          {mode === 'view' && resource.current_booking && (
            <div className="space-y-4">
              <div className="mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  🔴 Locked
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Booked By</label>
                  <p className="text-sm text-gray-900 font-medium">{resource.current_booking.booked_by}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Branch</label>
                  <p className="text-sm text-gray-900 font-medium">{resource.current_booking.branch}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Expires At</label>
                  <p className="text-sm text-gray-900 font-medium">{formatDateTime(resource.current_booking.expires_at)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                  <p className="text-sm text-gray-900">{resource.current_booking.notes || '-'}</p>
                </div>
              </div>

              {resource.current_booking.build_link && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Build Link</label>
                  <a
                    href={resource.current_booking.build_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 break-all"
                  >
                    {resource.current_booking.build_link}
                  </a>
                </div>
              )}

              {resource.current_booking.created_at && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created At</label>
                  <p className="text-sm text-gray-900">{formatDateTime(resource.current_booking.created_at)}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-gray-200 grid grid-cols-2 gap-3">
                <button
                  onClick={handleRelease}
                  disabled={loading}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Releasing...' : 'Release'}
                </button>
                <button
                  onClick={() => setMode('extend')}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                >
                  Extend
                </button>
              </div>
            </div>
          )}

          {/* Book Mode */}
          {mode === 'book' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bookedBy}
                  onChange={(e) => setBookedBy(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="feature/new-feature"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expiry Time <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {Object.entries(presets).map(([key, date]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setExpiresAt(date)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        expiresAt.getTime() === date.getTime()
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {key === '1h' && '1 hour'}
                      {key === '2h' && '2 hours'}
                      {key === '4h' && '4 hours'}
                      {key === 'eod' && 'End of day'}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={expiresAt.toISOString().slice(0, 16)}
                  onChange={(e) => setExpiresAt(new Date(e.target.value))}
                  className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="What are you testing?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Build Link</label>
                <input
                  type="url"
                  value={buildLink}
                  onChange={(e) => setBuildLink(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="mt-5 pt-4 border-t border-gray-200">
                <button
                  onClick={handleBook}
                  disabled={loading || !branch.trim() || !bookedBy.trim()}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Booking...' : 'Book'}
                </button>
              </div>
            </div>
          )}

          {/* Extend Mode */}
          {mode === 'extend' && resource.current_booking && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Expiry</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDateTime(resource.current_booking.expires_at)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quick Extend</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpiresAt(addHours(new Date(resource.current_booking!.expires_at), 1))}
                    className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiresAt(addHours(new Date(resource.current_booking!.expires_at), 2))}
                    className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    +2h
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiresAt(addHours(new Date(resource.current_booking!.expires_at), 4))}
                    className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    +4h
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Or Select New Expiry</label>
                <input
                  type="datetime-local"
                  value={expiresAt.toISOString().slice(0, 16)}
                  onChange={(e) => setExpiresAt(new Date(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div className="mt-5 pt-4 border-t border-gray-200">
                <button
                  onClick={handleExtend}
                  disabled={loading}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Extending...' : 'Extend'}
                </button>
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {mode === 'edit' && resource.current_booking && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="feature/new-feature"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="What are you testing?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Build Link</label>
                <input
                  type="url"
                  value={buildLink}
                  onChange={(e) => setBuildLink(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="mt-5 pt-4 border-t border-gray-200">
                <button
                  onClick={handleEdit}
                  disabled={loading || !branch.trim()}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
