// Google Cloud Build Integration Service
// This service fetches build triggers and build information from GCP

// Note: This requires Google Cloud Build API access and authentication
// Setup instructions:
// 1. Enable Cloud Build API in GCP Console
// 2. Create a service account with Cloud Build Viewer role
// 3. Download service account key and set VITE_GCP_SERVICE_ACCOUNT_KEY
// 4. Set VITE_GCP_PROJECT_ID in your .env file

// IMPORTANT: Google Cloud libraries are Node.js-only and cannot run in browsers
// This code requires a backend proxy in production. See CLOUD_BUILD_SETUP.md

import { supabase } from './supabase';

const GCP_PROJECT_ID = import.meta.env.VITE_GCP_PROJECT_ID;
const GCP_SERVICE_ACCOUNT_KEY = import.meta.env.VITE_GCP_SERVICE_ACCOUNT_KEY;

// Type definition for CloudBuildClient
type CloudBuildClient = any;

// Initialize Cloud Build client (browser-safe)
let cloudBuildClient: CloudBuildClient | null = null;
let clientInitError: string | null = null;

async function getCloudBuildClient(): Promise<CloudBuildClient | null> {
  if (clientInitError) {
    console.warn('Cloud Build client previously failed to initialize:', clientInitError);
    return null;
  }

  if (!GCP_PROJECT_ID) {
    console.error('GCP_PROJECT_ID not configured');
    return null;
  }

  if (!cloudBuildClient) {
    try {
      // Dynamic import to prevent bundling issues
      // This will fail in browser environments - that's expected
      const { CloudBuildClient } = await import('@google-cloud/cloudbuild');

      // Parse service account key if provided as JSON string
      const credentials = GCP_SERVICE_ACCOUNT_KEY
        ? JSON.parse(GCP_SERVICE_ACCOUNT_KEY)
        : undefined;

      cloudBuildClient = new CloudBuildClient({
        projectId: GCP_PROJECT_ID,
        credentials,
      });

      console.log('Cloud Build client initialized successfully');
    } catch (error) {
      const errorMsg = 'Cloud Build integration requires a backend service. See CLOUD_BUILD_SETUP.md';
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

  try {
    const [triggers] = await client.listBuildTriggers({
      projectId: GCP_PROJECT_ID,
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

  try {
    const [builds] = await client.listBuilds({
      projectId: GCP_PROJECT_ID,
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

  try {
    const [build] = await client.getBuild({
      projectId: GCP_PROJECT_ID,
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

  try {
    const [builds] = await client.listBuilds({
      projectId: GCP_PROJECT_ID,
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

  try {
    const [operation] = await client.runBuildTrigger({
      projectId: GCP_PROJECT_ID,
      triggerId: triggerId,
      source: {
        projectId: GCP_PROJECT_ID,
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
