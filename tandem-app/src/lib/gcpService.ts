// Google Cloud Build Integration Service
// This service implements the IntegrationProvider interface for GCP Cloud Build

// The Cloud Build API runs in serverless API routes (/api/gcp/*)
// These API routes use @google-cloud/cloudbuild package server-side
// Frontend calls these API routes, which are deployed alongside the app

import { supabase } from './supabase';
import type { IntegrationProvider, ConfigField, SyncResult } from '../types/integrations';
import { getIntegrationConfig } from '../types/integrations';

// API base URL - defaults to same origin (relative path)
// In development: http://localhost:5173/api
// In production: /api (same domain)
const API_BASE_URL = '/api';

// Get configuration from localStorage
function getGCPConfig() {
  const config = getIntegrationConfig('gcp-cloud-build');
  if (!config || !config.enabled) {
    return { projectId: null, serviceAccountKey: null };
  }

  return {
    projectId: config.settings.projectId || null,
    serviceAccountKey: config.settings.serviceAccountKey || null,
  };
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
  status:
    | 'STATUS_UNKNOWN'
    | 'QUEUED'
    | 'WORKING'
    | 'SUCCESS'
    | 'FAILURE'
    | 'INTERNAL_ERROR'
    | 'TIMEOUT'
    | 'CANCELLED';
  createTime: string;
  startTime?: string;
  finishTime?: string;
  logUrl?: string;
  substitutions?: Record<string, any>;
  sourceProvenance?: {
    resolvedRepoSource?: {
      commitSha?: string;
    };
  };
}

// Fetch all build triggers from GCP via API route
export async function fetchBuildTriggers(): Promise<BuildTrigger[]> {
  const { projectId, serviceAccountKey } = getGCPConfig();

  if (!projectId) {
    console.warn('GCP Project ID not configured');
    return [];
  }

  if (!serviceAccountKey) {
    console.warn('Service Account Key not configured');
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/gcp/triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        serviceAccountKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch triggers');
    }

    const data = await response.json();
    return data.triggers || [];
  } catch (error) {
    console.error('Error fetching build triggers:', error);
    throw error;
  }
}

// Fetch latest builds for a specific trigger
// TODO: Implement API route if needed
export async function fetchBuildsForTrigger(_triggerId: string, _limit: number = 10): Promise<Build[]> {
  console.warn('fetchBuildsForTrigger: Not implemented yet');
  return [];
}

// Fetch a specific build by ID
// TODO: Implement API route if needed
export async function fetchBuildById(_buildId: string): Promise<Build | null> {
  console.warn('fetchBuildById: Not implemented yet');
  return null;
}

// Fetch all recent builds (not filtered by trigger)
// TODO: Implement API route if needed
export async function fetchAllBuilds(_limit: number = 20): Promise<Build[]> {
  console.warn('fetchAllBuilds: Not implemented yet');
  return [];
}

// Trigger a build (requires Cloud Build Editor role)
// TODO: Implement API route if needed
export async function triggerBuild(_triggerId: string, _branchName: string): Promise<Build | null> {
  console.warn('triggerBuild: Not implemented yet');
  return null;
}

// Helper: Format build status for display
export function formatBuildStatus(
  status: Build['status']
): {
  label: string;
  color: string;
  icon: string;
} {
  const statusMap = {
    STATUS_UNKNOWN: { label: 'Unknown', color: 'gray', icon: '❓' },
    QUEUED: { label: 'Queued', color: 'yellow', icon: '⏳' },
    WORKING: { label: 'Running', color: 'blue', icon: '🔄' },
    SUCCESS: { label: 'Success', color: 'green', icon: '✅' },
    FAILURE: { label: 'Failed', color: 'red', icon: '❌' },
    INTERNAL_ERROR: { label: 'Error', color: 'red', icon: '❌' },
    TIMEOUT: { label: 'Timeout', color: 'orange', icon: '⏱️' },
    CANCELLED: { label: 'Cancelled', color: 'gray', icon: '🚫' },
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
export async function syncTriggersToResources(): Promise<SyncResult> {
  const result: SyncResult = {
    success: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Fetch all triggers from GCP (via API route)
    const triggers = await fetchBuildTriggers();

    if (triggers.length === 0) {
      result.errors.push(
        'No build triggers found in your GCP project. Make sure you have Cloud Build triggers configured.'
      );
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
    return !!(projectId && projectId.trim().length > 0 && serviceAccountKey && serviceAccountKey.trim().length > 0);
  },

  validateConfig(settings: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!settings.projectId || settings.projectId.trim() === '') {
      errors.push('Project ID is required');
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
          'Service account JSON key with Cloud Build Viewer role. Stored in browser localStorage and sent to API route for server-side Cloud Build API calls.',
      },
    ];
  },
};
