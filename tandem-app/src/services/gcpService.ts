// Google Cloud Build Integration Service
// Phase 2: This service will fetch build triggers and build information from GCP

// Note: This requires Google Cloud Build API access and authentication
// For Phase 2, we'll need to:
// 1. Enable Cloud Build API in GCP
// 2. Create a service account with Cloud Build Viewer role
// 3. Set up OAuth or service account credentials
// 4. Install @google-cloud/cloudbuild package

// @ts-ignore - Phase 2 feature
const GCP_PROJECT_ID = import.meta.env.VITE_GCP_PROJECT_ID;

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

// Phase 2: Fetch all build triggers from GCP
export async function fetchBuildTriggers(): Promise<BuildTrigger[]> {
  // TODO: Implement using Google Cloud Build API
  // const { CloudBuildClient } = require('@google-cloud/cloudbuild');
  // const client = new CloudBuildClient();
  // const [triggers] = await client.listBuildTriggers({ projectId: GCP_PROJECT_ID });
  // return triggers;

  console.warn('fetchBuildTriggers() not yet implemented - Phase 2 feature');
  return [];
}

// Phase 2: Fetch latest builds for a specific trigger
export async function fetchBuildsForTrigger(_triggerId: string, _limit: number = 5): Promise<Build[]> {
  // TODO: Implement using Google Cloud Build API
  // const { CloudBuildClient } = require('@google-cloud/cloudbuild');
  // const client = new CloudBuildClient();
  // const [builds] = await client.listBuilds({
  //   projectId: GCP_PROJECT_ID,
  //   filter: `trigger_id="${triggerId}"`,
  //   pageSize: limit,
  // });
  // return builds;

  console.warn('fetchBuildsForTrigger() not yet implemented - Phase 2 feature');
  return [];
}

// Phase 2: Fetch a specific build by ID
export async function fetchBuildById(_buildId: string): Promise<Build | null> {
  // TODO: Implement using Google Cloud Build API
  // const { CloudBuildClient } = require('@google-cloud/cloudbuild');
  // const client = new CloudBuildClient();
  // const [build] = await client.getBuild({
  //   projectId: GCP_PROJECT_ID,
  //   id: buildId,
  // });
  // return build;

  console.warn('fetchBuildById() not yet implemented - Phase 2 feature');
  return null;
}

// Phase 3: Trigger a build
export async function triggerBuild(_triggerId: string, _branchName: string): Promise<Build | null> {
  // TODO: Implement using Google Cloud Build API
  // const { CloudBuildClient } = require('@google-cloud/cloudbuild');
  // const client = new CloudBuildClient();
  // const [operation] = await client.runBuildTrigger({
  //   projectId: GCP_PROJECT_ID,
  //   triggerId: triggerId,
  //   source: {
  //     branchName: branchName,
  //   },
  // });
  // const [build] = await operation.promise();
  // return build;

  console.warn('triggerBuild() not yet implemented - Phase 3 feature');
  return null;
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

// Phase 2: Sync GCP build triggers to Tandem resources
// This function can be called from the admin panel to import triggers as resources
export async function syncTriggersToResources(): Promise<{
  success: number;
  skipped: number;
  errors: string[];
}> {
  // TODO: Implement
  // 1. Fetch all triggers from GCP
  // 2. For each trigger, check if resource exists in Supabase
  // 3. If not, create new resource with trigger name
  // 4. Return summary of sync operation

  console.warn('syncTriggersToResources() not yet implemented - Phase 2 feature');
  return { success: 0, skipped: 0, errors: ['Not implemented yet'] };
}
