import { useState, useEffect } from 'react';
import type { IntegrationProvider, IntegrationConfig, SyncResult } from '../types/integrations';
import {
  saveIntegrationConfig,
  getIntegrationConfig,
  deleteIntegrationConfig,
} from '../types/integrations';

interface IntegrationSettingsProps {
  provider: IntegrationProvider;
  onSyncComplete?: (result: SyncResult) => void;
  onConfigChange?: () => void;
}

export default function IntegrationSettings({
  provider,
  onSyncComplete,
  onConfigChange,
}: IntegrationSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    loadConfig();
  }, [provider.type]);

  const loadConfig = () => {
    const config = getIntegrationConfig(provider.type);
    if (config) {
      setSettings(config.settings || {});
      setIsConfigured(provider.isConfigured());
    } else {
      setSettings({});
      setIsConfigured(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setErrors([]);
  };

  const handleSave = () => {
    const validation = provider.validateConfig(settings);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const config: IntegrationConfig = {
      type: provider.type,
      enabled: true,
      name: provider.name,
      description: provider.description,
      settings,
    };

    saveIntegrationConfig(config);
    setIsConfigured(true);
    setErrors([]);
    setIsExpanded(false);

    if (onConfigChange) {
      onConfigChange();
    }
  };

  const handleDisable = () => {
    if (confirm(`Are you sure you want to disable ${provider.name} integration?`)) {
      deleteIntegrationConfig(provider.type);
      setIsConfigured(false);
      setSettings({});
      setErrors([]);
      setIsExpanded(false);

      if (onConfigChange) {
        onConfigChange();
      }
    }
  };

  const handleSync = async () => {
    if (!isConfigured) {
      setErrors(['Please configure the integration first']);
      return;
    }

    setSyncing(true);
    setSyncResult(null);
    setErrors([]);

    try {
      const result = await provider.syncResources();
      setSyncResult(result);

      if (onSyncComplete) {
        onSyncComplete(result);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Sync failed']);
    } finally {
      setSyncing(false);
    }
  };

  const configFields = provider.getConfigFields();

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-600">{provider.description}</p>
          </div>
          {isConfigured && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Configured
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {isConfigured && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
          >
            {isExpanded ? 'Hide' : isConfigured ? 'Reconfigure' : 'Configure'}
          </button>
        </div>
      </div>

      {/* Configuration Form */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          {configFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  value={settings[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={6}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-mono"
                />
              ) : field.type === 'select' ? (
                <select
                  value={settings[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select...</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={settings[field.key] || ''}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              )}

              {field.description && (
                <p className="mt-1 text-xs text-gray-500">{field.description}</p>
              )}
            </div>
          ))}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm font-semibold text-red-800 mb-1">Configuration Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-700">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Save Configuration
            </button>
            <button
              onClick={() => {
                setIsExpanded(false);
                setErrors([]);
                loadConfig();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
            >
              Cancel
            </button>
            {isConfigured && (
              <button
                onClick={handleDisable}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium"
              >
                Disable Integration
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div
          className={`mt-4 p-3 rounded-md ${
            syncResult.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
          } border`}
        >
          <p className="text-sm font-semibold mb-1">
            Sync Complete: {syncResult.success} created, {syncResult.skipped} skipped
            {syncResult.errors.length > 0 && `, ${syncResult.errors.length} errors`}
          </p>
          {syncResult.errors.length > 0 && (
            <ul className="list-disc list-inside text-xs text-yellow-700 mt-2">
              {syncResult.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
