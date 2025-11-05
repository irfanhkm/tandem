// Google Cloud Build Integration Service
// This service implements the IntegrationProvider interface for GCP Cloud Build

import { supabase } from './supabase';
import type { IntegrationProvider, ConfigField, SyncResult } from '../types/integrations';
import { getIntegrationConfig } from '../types/integrations';

// Default GCP Project ID - can be overridden by user
const DEFAULT_GCP_PROJECT_ID = 'your-gcp-project-id';

// Type definition for CloudBuildClient
type CloudBuildClient = any;

// Cloud Build client cache
let cloudBuildClient: CloudBuildClient | null = null;
let clientInitError: string | null = null;
let lastConfigHash: string | null = null;

// Get configuration from localStorage
function getGCPConfig() {
  const config = getIntegrationConfig('gcp-cloud-build');
  if (!config || !config.enabled) {
    return { projectId: null, serviceAccountKey: null };
  }

  return {
    projectId: config.settings.projectId || DEFAULT_GCP_PROJECT_ID,
    serviceAccountKey: config.settings.serviceAccountKey || null,
  };
}

// Initialize Cloud Build client (browser-safe)
async function getCloudBuildClient(): Promise<CloudBuildClient | null> {
  const { projectId, serviceAccountKey } = getGCPConfig();

  if (!projectId || projectId === 'your-gcp-project-id') {
    console.warn('GCP Project ID not configured. Please configure Cloud Build integration.');
    return null;
  }

  if (!serviceAccountKey) {
    console.warn('Service Account Key not configured. Please configure Cloud Build integration.');
    return null;
  }

  // Create a hash of current config to detect changes
  const configHash = projectId + ':' + serviceAccountKey.substring(0, 50);

  // Reset client if config changed
  if (lastConfigHash && lastConfigHash !== configHash) {
    cloudBuildClient = null;
    clientInitError = null;
  }

  lastConfigHash = configHash;

  if (clientInitError) {
    console.warn('Cloud Build client previously failed to initialize:', clientInitError);
    return null;
  }

  if (!cloudBuildClient) {
    try {
      // Dynamic import to prevent bundling issues
      // This will fail in browser environments - that's expected
      const { CloudBuildClient } = await import('@google-cloud/cloudbuild');

      // Parse service account key
      const credentials = JSON.parse(serviceAccountKey);

      cloudBuildClient = new CloudBuildClient({
        projectId,
        credentials,
      });

      console.log('Cloud Build client initialized successfully for project:', projectId);
    } catch (error) {
      const errorMsg =
        'Cloud Build integration requires a backend service in production. Currently running in demo mode.';
      clientInitError = errorMsg;
      console.warn(errorMsg, error);
      return null;
    }
  }

  return cloudBuildClient;
}

export interface BuildTrigger {
  id: string;
  name: string;
  description?: string;
  filename?: string;
  github?: {
    owner: string;
    name: string;
    branch?: string;
  };
  createTime?: string;
  disabled?: boolean;
}

export interface Build {
  id: string;
  projectId: string;
  status: 'STATUS_UNKNOWN' | 'QUEUED' | 'WORKING' | 'SUCCESS' | 'FAILURE' | 'INTERNAL_ERROR' | 'TIMEOUT' | 'CANCELLED';
  createTime: string;
  startTime?: string;
  finishTime?: string;
  logUrl?: string;
  substitutions?: Record<string, string>;
  sourceProvenance?: {
    resolvedRepoSource?: {
      commitSha?: string;
    };
  };
}

// Fetch all build triggers from GCP
export async function fetchBuildTriggers(): Promise<BuildTrigger[]> {
  const client = await getCloudBuildClient();
  if (!client) {
    console.warn('Cloud Build client not initialized');
    return [];
  }

  const { projectId } = getGCPConfig();
  if (!projectId) return [];

  try {
    const [triggers] = await client.listBuildTriggers({
      projectId,
    });

    return (triggers || []).map((trigger: any) => ({
      id: trigger.id || '',
      name: trigger.name || '',
      description: trigger.description || '',
      filename: trigger.filename || '',
      github: trigger.github
        ? {
            owner: trigger.github.owner || '',
            name: trigger.github.name || '',
            branch: trigger.github.push?.branch || '',
          }
        : undefined,
      createTime: trigger.createTime || '',
      disabled: trigger.disabled || false,
    }));
  } catch (error) {
    console.error('Error fetching build triggers:', error);
    return [];
  }
}

// Fetch latest builds for a specific trigger
export async function fetchBuildsForTrigger(triggerId: string, limit: number = 10): Promise<Build[]> {
  const client = await getCloudBuildClient();
  if (!client) {
    console.warn('Cloud Build client not initialized');
    return [];
  }

  const { projectId } = getGCPConfig();
  if (!projectId) return [];

  try {
    const [builds] = await client.listBuilds({
      projectId,
      filter: `build_trigger_id="${triggerId}"`,
      pageSize: limit,
    });

    return (builds || []).map((build: any) => ({
      id: build.id || '',
      projectId: build.projectId || '',
      status: build.status || 'STATUS_UNKNOWN',
      createTime: build.createTime || '',
      startTime: build.startTime || '',
      finishTime: build.finishTime || '',
      logUrl: build.logUrl || '',
      substitutions: build.substitutions || {},
      sourceProvenance: build.sourceProvenance,
    }));
  } catch (error) {
    console.error('Error fetching builds for trigger:', error);
    return [];
  }
}

// Fetch a specific build by ID
export async function fetchBuildById(buildId: string): Promise<Build | null> {
  const client = await getCloudBuildClient();
  if (!client) {
    console.warn('Cloud Build client not initialized');
    return null;
  }

  const { projectId } = getGCPConfig();
  if (!projectId) return null;

  try {
    const [build] = await client.getBuild({
      projectId,
      id: buildId,
    });

    if (!build) return null;

    return {
      id: build.id || '',
      projectId: build.projectId || '',
      status: build.status || 'STATUS_UNKNOWN',
      createTime: build.createTime || '',
      startTime: build.startTime || '',
      finishTime: build.finishTime || '',
      logUrl: build.logUrl || '',
      substitutions: build.substitutions || {},
      sourceProvenance: build.sourceProvenance,
    } as Build;
  } catch (error) {
    console.error('Error fetching build by ID:', error);
    return null;
  }
}

// Fetch all recent builds (not filtered by trigger)
export async function fetchAllBuilds(limit: number = 20): Promise<Build[]> {
  const client = await getCloudBuildClient();
  if (!client) {
    console.warn('Cloud Build client not initialized');
    return [];
  }

  const { projectId } = getGCPConfig();
  if (!projectId) return [];

  try {
    const [builds] = await client.listBuilds({
      projectId,
      pageSize: limit,
    });

    return (builds || []).map((build: any) => ({
      id: build.id || '',
      projectId: build.projectId || '',
      status: build.status || 'STATUS_UNKNOWN',
      createTime: build.createTime || '',
      startTime: build.startTime || '',
      finishTime: build.finishTime || '',
      logUrl: build.logUrl || '',
      substitutions: build.substitutions || {},
      sourceProvenance: build.sourceProvenance,
    }));
  } catch (error) {
    console.error('Error fetching all builds:', error);
    return [];
  }
}

// Trigger a build (requires Cloud Build Editor role)
export async function triggerBuild(triggerId: string, branchName: string): Promise<Build | null> {
  const client = await getCloudBuildClient();
  if (!client) {
    console.warn('Cloud Build client not initialized');
    return null;
  }

  const { projectId } = getGCPConfig();
  if (!projectId) return null;

  try {
    const [operation] = await client.runBuildTrigger({
      projectId,
      triggerId: triggerId,
      source: {
        projectId,
        branchName: branchName,
      },
    });

    // Wait for the operation to complete and get the build
    const [build] = await operation.promise();

    if (!build) return null;

    return {
      id: build.id || '',
      projectId: build.projectId || '',
      status: build.status || 'STATUS_UNKNOWN',
      createTime: build.createTime || '',
      startTime: build.startTime || '',
      finishTime: build.finishTime || '',
      logUrl: build.logUrl || '',
      substitutions: build.substitutions || {},
      sourceProvenance: build.sourceProvenance,
    } as Build;
  } catch (error) {
    console.error('Error triggering build:', error);
    return null;
  }
}

// Helper: Format build status for display
export function formatBuildStatus(status: Build['status']): {
  label: string;
  color: string;
  icon: string;
} {
  const statusMap = {
    'STATUS_UNKNOWN': { label: 'Unknown', color: 'gray', icon: '❓' },
    'QUEUED': { label: 'Queued', color: 'yellow', icon: '⏳' },
    'WORKING': { label: 'Running', color: 'blue', icon: '🔄' },
    'SUCCESS': { label: 'Success', color: 'green', icon: '✅' },
    'FAILURE': { label: 'Failed', color: 'red', icon: '❌' },
    'INTERNAL_ERROR': { label: 'Error', color: 'red', icon: '❌' },
    'TIMEOUT': { label: 'Timeout', color: 'orange', icon: '⏱️' },
    'CANCELLED': { label: 'Cancelled', color: 'gray', icon: '🚫' },
  };
  return statusMap[status] || statusMap['STATUS_UNKNOWN'];
}

// Helper: Extract commit SHA from build
export function getCommitSha(build: Build): string | null {
  return build.sourceProvenance?.resolvedRepoSource?.commitSha || null;
}

// Helper: Get build duration in seconds
export function getBuildDuration(build: Build): number | null {
  if (!build.startTime || !build.finishTime) return null;
  const start = new Date(build.startTime).getTime();
  const finish = new Date(build.finishTime).getTime();
  return Math.round((finish - start) / 1000);
}

// Sync GCP build triggers to Tandem resources
// This function can be called from the admin panel to import triggers as resources
export async function syncTriggersToResources(): Promise<{
  success: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    success: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // 1. Fetch all triggers from GCP
    const triggers = await fetchBuildTriggers();

    if (triggers.length === 0) {
      result.errors.push('No build triggers found in GCP');
      return result;
    }

    // 2. For each trigger, check if resource exists in Supabase
    for (const trigger of triggers) {
      try {
        // Check if resource with this name already exists
        const { data: existingResource, error: fetchError } = await supabase
          .from('resources')
          .select('id')
          .eq('name', trigger.name)
          .is('deleted_at', null)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = not found, which is expected
          result.errors.push(`Error checking resource ${trigger.name}: ${fetchError.message}`);
          continue;
        }

        if (existingResource) {
          result.skipped++;
          continue;
        }

        // 3. Create new resource with trigger name
        const labels = ['cloud-build', 'gcp'];
        if (trigger.github) {
          labels.push('github');
        }
        if (trigger.disabled) {
          labels.push('disabled');
        }

        const { error: insertError } = await supabase.from('resources').insert({
          name: trigger.name,
          labels: labels.join(','),
        });

        if (insertError) {
          result.errors.push(`Error creating resource ${trigger.name}: ${insertError.message}`);
          continue;
        }

        result.success++;
      } catch (error) {
        result.errors.push(
          `Error processing trigger ${trigger.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

// ==========================================
// Integration Provider Implementation
// ==========================================

export const GCPCloudBuildIntegration: IntegrationProvider = {
  type: 'gcp-cloud-build',
  name: 'Google Cloud Build',
  description: 'Sync build triggers from Google Cloud Build as bookable resources',

  isConfigured(): boolean {
    const config = getIntegrationConfig('gcp-cloud-build');
    if (!config || !config.enabled) return false;

    const { projectId, serviceAccountKey } = config.settings;
    return !!(
      projectId &&
      projectId !== 'your-gcp-project-id' &&
      serviceAccountKey &&
      serviceAccountKey.trim().length > 0
    );
  },

  validateConfig(settings: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!settings.projectId || settings.projectId.trim() === '') {
      errors.push('Project ID is required');
    }

    if (
      settings.projectId === 'your-gcp-project-id' ||
      settings.projectId === DEFAULT_GCP_PROJECT_ID
    ) {
      errors.push('Please enter your actual GCP Project ID');
    }

    if (!settings.serviceAccountKey || settings.serviceAccountKey.trim() === '') {
      errors.push('Service Account Key (JSON) is required');
    } else {
      try {
        const parsed = JSON.parse(settings.serviceAccountKey);
        if (!parsed.type || parsed.type !== 'service_account') {
          errors.push('Invalid service account key: must be a service account JSON');
        }
        if (!parsed.project_id) {
          errors.push('Invalid service account key: missing project_id');
        }
        if (!parsed.private_key) {
          errors.push('Invalid service account key: missing private_key');
        }
      } catch (error) {
        errors.push('Service Account Key must be valid JSON');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  async syncResources(): Promise<SyncResult> {
    return await syncTriggersToResources();
  },

  getConfigFields(): ConfigField[] {
    return [
      {
        key: 'projectId',
        label: 'GCP Project ID',
        type: 'text',
        placeholder: 'my-project-id',
        required: true,
        description: 'Your Google Cloud Platform Project ID',
      },
      {
        key: 'serviceAccountKey',
        label: 'Service Account Key (JSON)',
        type: 'textarea',
        placeholder: '{"type":"service_account","project_id":"...","private_key":"..."}',
        required: true,
        description:
          'Service account JSON key with Cloud Build Viewer role. This is stored temporarily in your browser\'s localStorage.',
      },
    ];
  },
};
