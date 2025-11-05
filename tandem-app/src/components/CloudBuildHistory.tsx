import { useState, useEffect } from 'react';
import {
  fetchBuildTriggers,
  fetchBuildsForTrigger,
  fetchAllBuilds,
  formatBuildStatus,
  getBuildDuration,
  syncTriggersToResources,
  type BuildTrigger,
  type Build,
} from '../services/gcpService';
import { formatRelativeTime } from '../utils/dateUtils';

interface CloudBuildHistoryProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export default function CloudBuildHistory({
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds default
}: CloudBuildHistoryProps) {
  const [triggers, setTriggers] = useState<BuildTrigger[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [view, setView] = useState<'triggers' | 'history'>('history');

  // Fetch triggers on mount
  useEffect(() => {
    loadTriggers();
  }, []);

  // Fetch all builds on mount and when view changes
  useEffect(() => {
    if (view === 'history') {
      loadAllBuilds();
    }
  }, [view]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (view === 'history' && !selectedTrigger) {
        loadAllBuilds();
      } else if (selectedTrigger) {
        loadBuildsForTrigger(selectedTrigger);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, view, selectedTrigger]);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBuildTriggers();
      setTriggers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load triggers');
    } finally {
      setLoading(false);
    }
  };

  const loadAllBuilds = async () => {
    try {
      setError(null);
      const data = await fetchAllBuilds(50);
      setBuilds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load builds');
    }
  };

  const loadBuildsForTrigger = async (triggerId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBuildsForTrigger(triggerId, 20);
      setBuilds(data);
      setSelectedTrigger(triggerId);
      setView('history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load builds');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTriggers = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncTriggersToResources();
      const message = `Sync complete: ${result.success} created, ${result.skipped} skipped${
        result.errors.length > 0 ? `, ${result.errors.length} errors` : ''
      }`;
      setSyncResult(message);
      if (result.errors.length > 0) {
        console.error('Sync errors:', result.errors);
      }
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const clearTriggerFilter = () => {
    setSelectedTrigger(null);
    loadAllBuilds();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cloud Build</h2>
          <p className="text-gray-600 text-sm">
            View build triggers and build history from GCP
            {autoRefresh && (
              <span className="ml-2 text-green-600">
                (Auto-refresh every {refreshInterval / 1000}s)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('triggers')}
            className={`px-4 py-2 rounded ${
              view === 'triggers'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Triggers ({triggers.length})
          </button>
          <button
            onClick={() => {
              setView('history');
              if (!selectedTrigger) loadAllBuilds();
            }}
            className={`px-4 py-2 rounded ${
              view === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Build History
          </button>
        </div>
      </div>

      {/* Sync Button */}
      {view === 'triggers' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-blue-900">Sync Triggers to Resources</h3>
              <p className="text-sm text-blue-700">
                Import Cloud Build triggers as bookable resources
              </p>
            </div>
            <button
              onClick={handleSyncTriggers}
              disabled={syncing || triggers.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          {syncResult && (
            <div className="mt-2 text-sm text-blue-900 bg-blue-100 p-2 rounded">
              {syncResult}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Triggers View */}
      {view === 'triggers' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading triggers...</div>
          ) : triggers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No build triggers found. Make sure VITE_GCP_PROJECT_ID and
              VITE_GCP_SERVICE_ACCOUNT_KEY are configured.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {triggers.map((trigger) => (
                  <tr key={trigger.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trigger.name}</div>
                      {trigger.description && (
                        <div className="text-sm text-gray-500">{trigger.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trigger.github ? (
                        <span>
                          {trigger.github.owner}/{trigger.github.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trigger.github?.branch || (
                        <span className="text-gray-400">Any branch</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          trigger.disabled
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {trigger.disabled ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => loadBuildsForTrigger(trigger.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Builds
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Build History View */}
      {view === 'history' && (
        <>
          {selectedTrigger && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 flex justify-between items-center">
              <span className="text-blue-900">
                Showing builds for trigger:{' '}
                <strong>{triggers.find((t) => t.id === selectedTrigger)?.name}</strong>
              </span>
              <button
                onClick={clearTriggerFilter}
                className="text-blue-600 hover:text-blue-900 text-sm"
              >
                Show All Builds
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading && builds.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Loading builds...</div>
            ) : builds.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No builds found. Make sure VITE_GCP_PROJECT_ID and
                VITE_GCP_SERVICE_ACCOUNT_KEY are configured.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Build ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {builds.map((build) => {
                    const statusInfo = formatBuildStatus(build.status);
                    const duration = getBuildDuration(build);
                    const branch =
                      build.substitutions?.BRANCH_NAME || build.substitutions?.BRANCH || 'N/A';

                    return (
                      <tr key={build.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">
                            {build.id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              statusInfo.color === 'green'
                                ? 'bg-green-100 text-green-800'
                                : statusInfo.color === 'red'
                                  ? 'bg-red-100 text-red-800'
                                  : statusInfo.color === 'blue'
                                    ? 'bg-blue-100 text-blue-800'
                                    : statusInfo.color === 'yellow'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatRelativeTime(build.createTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {duration ? `${duration}s` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {branch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {build.logUrl && (
                            <a
                              href={build.logUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Logs
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
