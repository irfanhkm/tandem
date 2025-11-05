# Cloud Build Integration Setup Guide

This guide explains how to set up and use the Google Cloud Build integration in Tandem.

## Overview

The Cloud Build integration is an **addon feature** that allows you to:
- Automatically sync Cloud Build triggers from your GCP project as bookable resources
- One-click sync directly from the Admin Panel
- Secure configuration stored in browser localStorage (no backend storage)
- Extensible architecture for future integrations (AWS, Azure, Jenkins, etc.)

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

### Step 5: Deploy the Application

The application includes API routes that need to be deployed alongside the frontend.

**For Production (Vercel - Recommended):**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from tandem-app directory)
vercel
```

Vercel automatically detects and deploys both the frontend and `/api` routes as serverless functions.

**For Development:**
```bash
cd tandem-app

# Option 1: Use Vercel Dev (handles both frontend and API)
npx vercel dev

# Option 2: Just frontend (you'll need to deploy API separately)
npm run dev
```

See `api/README.md` for other deployment options (Netlify, self-hosted, etc.)

### Step 6: Configure the Integration in the UI

1. Navigate to **Admin Panel** (http://localhost:5173/admin)
2. Click the **⚙️ Integrations** button in the top right
3. Find **Google Cloud Build** integration
4. Click **Configure**
5. Enter your configuration:
   - **GCP Project ID**: Your GCP project ID (e.g., `my-project-123`)
   - **Service Account Key (JSON)**: Paste the entire JSON file contents
6. Click **Save Configuration**
7. The integration will validate your configuration
8. If successful, you'll see a "Configured" badge

### Step 7: Sync Triggers to Resources

1. In the same integration panel, click **Sync Now**
2. The system will:
   - Fetch all build triggers from your GCP project
   - Import them as bookable resources
   - Skip any that already exist
3. View the sync results (created, skipped, errors)
4. Close the integrations panel
5. Your synced resources will now appear in the resources table!

## Using the Integration

### Syncing Triggers to Resources

Once configured, you can sync Cloud Build triggers to Tandem resources:

1. Go to **Admin Panel** → Click **⚙️ Integrations**
2. Find the **Google Cloud Build** integration
3. Click **Sync Now** button
4. Triggers will be imported as resources with:
   - **Name**: Same as trigger name
   - **Labels**: `cloud-build`, `gcp`, `github` (if applicable), `disabled` (if trigger is disabled)

### Managing Synced Resources

After syncing, the imported triggers appear as regular resources:

1. Users can book them from the Dashboard
2. Track who's using which build environment
3. Set expiration times for bookings
4. Add notes and build links

### Re-syncing

- Run sync multiple times safely - existing resources won't be duplicated
- New triggers will be added
- Existing triggers will be skipped
- Deleted triggers in GCP won't be removed from Tandem (manual cleanup required)

### Disabling the Integration

1. Go to **Admin Panel** → Click **⚙️ Integrations**
2. Click **Configure** on Google Cloud Build
3. Click **Disable Integration**
4. Confirm the action

Note: Disabling the integration does NOT delete synced resources. They remain in your resources list until manually deleted.

## Architecture

### Integration System

Tandem uses an **extensible integration architecture** that makes it easy to add new cloud providers:

#### Core Components

1. **Integration Abstraction** (`types/integrations.ts`)
   - `IntegrationProvider` interface defines the contract
   - `IntegrationConfig` stores settings in localStorage
   - Helper functions for configuration management

2. **Integration Settings UI** (`components/IntegrationSettings.tsx`)
   - Reusable component for any integration
   - Configuration form with validation
   - Sync button and status display
   - Error handling

3. **Service Implementation** (`services/gcpService.ts`)
   - Implements `IntegrationProvider` interface
   - `GCPCloudBuildIntegration` object exports the integration
   - Cloud Build API functions
   - localStorage-based configuration

#### Adding New Integrations

To add a new integration (AWS, Azure, etc.):

1. Create a new service file (e.g., `awsCodeBuildService.ts`)
2. Implement the `IntegrationProvider` interface:
   ```typescript
   export const AWSCodeBuildIntegration: IntegrationProvider = {
     type: 'aws-codebuild',
     name: 'AWS CodeBuild',
     description: '...',
     isConfigured() { ... },
     validateConfig(settings) { ... },
     syncResources() { ... },
     getConfigFields() { ... },
   };
   ```
3. Add it to the Admin panel:
   ```tsx
   <IntegrationSettings provider={AWSCodeBuildIntegration} />
   ```

### Data Storage

- **Integration settings**: Stored in browser localStorage
- **Service account keys**: Never sent to backend, stored locally
- **Synced resources**: Saved to Supabase as regular resources
- **No server-side integration credentials** required

### Realtime Updates

Supabase realtime subscriptions keep data synchronized:

#### Dashboard
- Granular updates instead of full refetch
- Updates only affected resources when bookings change
- Efficiently handles booking create/update/delete events
- Resource changes update labels dynamically

#### Admin Panel
- Real-time resource list updates
- Automatic refresh when resources are added/modified/deleted
- Syncs across all connected users

## Security Considerations

### Current Approach

The integration stores credentials in **browser localStorage**:

✅ **Advantages:**
- No backend required for simple deployments
- User controls their own credentials
- Credentials never leave the user's browser
- No server-side credential storage needed

⚠️ **Limitations:**
- Credentials accessible via browser DevTools
- Shared computer risk (others with access can see credentials)
- Lost if browser data cleared
- Not suitable for shared/production environments

### Production Recommendations

For production deployments with multiple users:

#### Option 1: Backend Proxy (Recommended)

Create a backend API that proxies Cloud Build requests:

```typescript
// Backend API (Node.js/Express example)
app.post('/api/integrations/gcp/sync', authenticate, async (req, res) => {
  // Store credentials server-side (encrypted in database)
  const { projectId, serviceKey } = getOrgSettings();

  const client = new CloudBuildClient({
    projectId,
    credentials: JSON.parse(serviceKey),
  });

  const [triggers] = await client.listBuildTriggers({ projectId });
  res.json(triggers);
});
```

Benefits:
- Credentials stored securely on server
- Single configuration for entire organization
- Can implement audit logging
- Rate limiting and access control

#### Option 2: Supabase Edge Functions

```typescript
// Supabase Edge Function
import { CloudBuildClient } from '@google-cloud/cloudbuild';

Deno.serve(async (req) => {
  // Get credentials from Supabase secrets
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const serviceKey = Deno.env.get('GCP_SERVICE_KEY');

  const client = new CloudBuildClient({
    projectId,
    credentials: JSON.parse(serviceKey),
  });

  const [triggers] = await client.listBuildTriggers({ projectId });
  return new Response(JSON.stringify(triggers));
});
```

Benefits:
- Serverless (no infrastructure to maintain)
- Credentials in Supabase secrets (encrypted)
- Easy to deploy alongside Supabase
- Integrated with Supabase auth

#### Option 3: Encrypted LocalStorage

For semi-shared environments:

```typescript
// Encrypt credentials before storing
import CryptoJS from 'crypto-js';

function saveEncrypted(data, userPassword) {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    userPassword
  ).toString();
  localStorage.setItem('integration', encrypted);
}
```

Benefits:
- Still client-side only
- Protection against casual access
- User must enter password to decrypt
- No backend changes needed

### Best Practices

Regardless of approach:

1. **Rotate credentials regularly**
2. **Use least-privilege service accounts** (Viewer role only)
3. **Enable audit logging** in GCP
4. **Implement session timeouts** for admin panel
5. **Add authentication** (currently open to all)
6. **Monitor API usage** for anomalies

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
