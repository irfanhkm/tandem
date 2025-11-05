# Cloud Build Integration Setup Guide

This guide explains how to set up and use the Google Cloud Build integration in Tandem.

## Overview

The Cloud Build integration allows you to:
- View all Cloud Build triggers from your GCP project
- Monitor build history and status in real-time
- Sync Cloud Build triggers as bookable resources
- Track build execution and logs
- Auto-refresh build status every 30 seconds

## Prerequisites

1. **Google Cloud Platform Account** with billing enabled
2. **Cloud Build API** enabled in your GCP project
3. **Service Account** with appropriate permissions
4. **Node.js 18+** and npm installed

## Setup Instructions

### Step 1: Enable Cloud Build API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Build API"
5. Click **Enable**

### Step 2: Create Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter details:
   - **Name**: `tandem-cloud-build-viewer`
   - **Description**: `Service account for Tandem to read Cloud Build data`
4. Click **Create and Continue**

### Step 3: Assign Permissions

Assign the following roles to your service account:

- **Cloud Build Viewer** (`roles/cloudbuild.builds.viewer`)
  - Allows reading build triggers and build history
  - Required for fetching build data

For triggering builds (optional):
- **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)
  - Allows triggering builds programmatically

### Step 4: Create and Download Key

1. Click on your service account
2. Go to **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Click **Create** - the key will download automatically
6. **Keep this file secure!** It contains credentials to access your GCP project

### Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration:
   ```bash
   # Your GCP Project ID
   VITE_GCP_PROJECT_ID=your-project-id

   # Service account key (entire JSON as a single-line string)
   VITE_GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project",...}'
   ```

3. To convert the JSON key file to a single-line string:
   ```bash
   # On Linux/Mac:
   cat service-account-key.json | jq -c

   # Or manually remove all newlines and extra spaces
   ```

### Step 6: Start the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Using Cloud Build Features

### Viewing Build Triggers

1. Navigate to **Admin Panel** (top navigation)
2. Click the **Cloud Build** tab
3. Click **Triggers** button to view all build triggers
4. You'll see:
   - Trigger name and description
   - GitHub repository (if configured)
   - Branch configuration
   - Enabled/disabled status

### Viewing Build History

1. In the **Cloud Build** tab, click **Build History**
2. View recent builds across all triggers with:
   - Build ID
   - Status (Success, Failed, Running, etc.)
   - Creation time
   - Duration
   - Branch name
   - Link to full logs

### Filtering by Trigger

1. Click **View Builds** on any trigger
2. See builds specific to that trigger
3. Click **Show All Builds** to return to full history

### Syncing Triggers to Resources

This feature imports Cloud Build triggers as bookable resources:

1. Go to **Admin Panel** > **Cloud Build** tab
2. Click on **Triggers** view
3. Click **Sync Now** button
4. Triggers will be imported as resources with:
   - Name: Same as trigger name
   - Labels: `cloud-build`, `gcp`, `github` (if applicable)

This allows team members to "book" build environments just like other resources.

### Auto-Refresh

Build history automatically refreshes every 30 seconds to show:
- New builds as they start
- Status updates (queued → running → success/failure)
- Completed builds with duration

You can disable auto-refresh by modifying the component:
```tsx
<CloudBuildHistory autoRefresh={false} />
```

## Architecture

### Frontend Components

- **CloudBuildHistory.tsx**: Main UI component
  - Displays triggers and build history
  - Handles auto-refresh
  - Manages sync operations

### Service Layer

- **gcpService.ts**: Cloud Build API integration
  - `fetchBuildTriggers()`: Get all triggers
  - `fetchAllBuilds()`: Get recent builds
  - `fetchBuildsForTrigger()`: Get builds for specific trigger
  - `fetchBuildById()`: Get single build details
  - `triggerBuild()`: Start a new build (requires Editor role)
  - `syncTriggersToResources()`: Import triggers as resources

### Realtime Updates

Both Dashboard and Admin panel now feature enhanced realtime updates:

#### Dashboard
- **Granular updates** instead of full refetch
- Updates only affected resources when bookings change
- Efficiently handles booking create/update/delete events
- Resource changes update labels dynamically

#### Admin Panel
- Real-time resource list updates
- Automatic refresh when resources are added/modified/deleted
- Syncs across all connected users

## Security Considerations

⚠️ **IMPORTANT**: The current implementation stores service account credentials in the frontend environment variables. This is **NOT RECOMMENDED for production**.

### Production Recommendations

1. **Create a Backend API**
   - Move Cloud Build API calls to a backend service
   - Store credentials securely on the server
   - Frontend calls your backend, which calls GCP

2. **Use Supabase Edge Functions**
   ```typescript
   // Example Edge Function
   import { CloudBuildClient } from '@google-cloud/cloudbuild';

   export default async (req) => {
     const client = new CloudBuildClient({
       credentials: JSON.parse(Deno.env.get('GCP_CREDENTIALS'))
     });
     const [builds] = await client.listBuilds({ projectId: '...' });
     return new Response(JSON.stringify(builds));
   };
   ```

3. **Implement Authentication**
   - Add Supabase Auth
   - Restrict Cloud Build access to authenticated users
   - Add role-based access control (Admin vs User)

4. **Use API Gateway**
   - Cloud Endpoints or API Gateway in front of Cloud Build API
   - Implement rate limiting and quotas
   - Add request validation

## Troubleshooting

### "Cloud Build client not initialized"

**Problem**: Service account credentials not configured

**Solution**:
1. Check that `VITE_GCP_PROJECT_ID` is set in `.env`
2. Verify `VITE_GCP_SERVICE_ACCOUNT_KEY` contains valid JSON
3. Ensure the JSON is properly escaped as a single-line string

### "Permission denied" errors

**Problem**: Service account lacks necessary permissions

**Solution**:
1. Go to IAM & Admin in GCP Console
2. Find your service account
3. Add "Cloud Build Viewer" role
4. Wait 1-2 minutes for permissions to propagate

### No triggers or builds showing

**Problem**: Project ID incorrect or no triggers exist

**Solution**:
1. Verify project ID in `.env` matches your GCP project
2. Check Cloud Build console to confirm triggers exist
3. Ensure Cloud Build API is enabled

### CORS errors

**Problem**: Browser blocking GCP API requests

**Solution**: This shouldn't happen with the Cloud Build client library, but if it does:
1. Implement a backend proxy (recommended)
2. Or add proper CORS configuration in GCP

### Build history not refreshing

**Problem**: Auto-refresh not working

**Solution**:
1. Check browser console for errors
2. Verify service account has access
3. Try manual refresh (switch tabs and back)

## API Rate Limits

Google Cloud Build API has the following quotas:
- **Read requests**: 1,000 per minute
- **List requests**: 60 per minute

The auto-refresh (every 30 seconds) stays well within these limits.

## Cost Considerations

- **Cloud Build API calls**: Free (no charge for API requests)
- **Cloud Build execution**: Charged per minute of build time
- **Service account**: Free

## Additional Resources

- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Cloud Build API Reference](https://cloud.google.com/build/docs/api/reference/rest)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review GCP Cloud Build logs
3. Check browser console for JavaScript errors
4. Verify Supabase configuration is correct
