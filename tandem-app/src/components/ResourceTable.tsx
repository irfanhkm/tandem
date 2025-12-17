'use client';

import { useEffect, useState } from 'react';
import type { Resource } from '../types';
import { formatDateTime, getTimeUntilExpiry, isExpired } from '../utils/dateUtils';

interface ResourceTableProps {
  resources: Resource[];
  onResourceClick: (resource: Resource) => void;
}

export const ResourceTable = ({ resources, onResourceClick }: ResourceTableProps) => {
  // Tick every minute so countdowns stay up to date
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60_000); // update every minute

    return () => clearInterval(interval);
  }, []);

  return (
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
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Booked By
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Branch
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Expiry
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {resources.map((resource) => (
            <tr
              key={resource.id}
              onClick={() => onResourceClick(resource)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {resource.name}
                </div>
                {resource.labels && (
                  <div className="mt-1 flex flex-wrap gap-1">
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
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {resource.status === 'FREE' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    🟢 Free
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🔴 Locked
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {resource.current_booking?.booked_by || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {resource.current_booking?.branch || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {resource.current_booking?.expires_at ? (
                  <div className="text-sm text-gray-900">
                    <div>{formatDateTime(resource.current_booking.expires_at)}</div>
                    <div
                      className={`text-xs ${
                        isExpired(resource.current_booking.expires_at)
                          ? 'text-red-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {getTimeUntilExpiry(resource.current_booking.expires_at, now)} left
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-900">-</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {resource.current_booking?.created_at
                    ? formatDateTime(resource.current_booking.created_at)
                    : '-'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
