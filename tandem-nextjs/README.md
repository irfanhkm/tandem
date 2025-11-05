# Tandem - Environment Coordination Platform

A Next.js-based resource booking and environment coordination platform with Google Cloud Build integration.

## Features

- **Resource Management**: Create and manage bookable resources (environments, services, etc.)
- **Booking System**: Lock/unlock resources with expiry times, branch info, and build links
- **Realtime Updates**: Live synchronization using Supabase realtime subscriptions
- **Cloud Build Integration**: Sync Google Cloud Build triggers as bookable resources
- **Soft Deletes**: Safe deletion with full audit trail
- **Labels & Filtering**: Organize resources with tags

## Tech Stack

- **Frontend**: Next.js 16 (React 19), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless functions)
- **Database**: Supabase (PostgreSQL with realtime subscriptions)
- **Cloud Integration**: Google Cloud Build API
- **Deployment**: Vercel, Netlify, or self-hosted

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- (Optional) Google Cloud Platform project with Cloud Build enabled

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tandem-nextjs
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Set up Supabase database:
   - Create tables as defined in the database schema (see Database Schema section)
   - Enable Row Level Security (RLS) if needed
   - Enable Realtime for `resources` and `bookings` tables

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

### Resources Table
```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  labels TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### Bookings Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id),
  booked_by TEXT NOT NULL,
  branch TEXT NOT NULL,
  notes TEXT,
  build_link TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### Booking History Table
```sql
CREATE TABLE booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  action TEXT NOT NULL,
  resource_id UUID,
  booked_by TEXT,
  branch TEXT,
  notes TEXT,
  build_link TEXT,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Google Cloud Build Integration

### Setup

1. Navigate to Admin Panel → ⚙️ Integrations
2. Click "Configure" on Google Cloud Build integration
3. Enter your GCP Project ID
4. Paste your Service Account Key JSON (requires Cloud Build Viewer role)
5. Click "Save Configuration"
6. Click "Sync Now" to import build triggers as resources

### Service Account Setup

Create a service account with Cloud Build Viewer role:

```bash
# Create service account
gcloud iam service-accounts create tandem-cloudbuild \
  --display-name="Tandem Cloud Build Integration"

# Grant Cloud Build Viewer role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:tandem-cloudbuild@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.viewer"

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=tandem-cloudbuild@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Copy the contents of `key.json` and paste into the integration settings.

## API Routes

Next.js API routes provide server-side functionality:

### POST /api/gcp/triggers
Fetches Cloud Build triggers from Google Cloud Platform.

**Request Body:**
```json
{
  "projectId": "my-gcp-project",
  "serviceAccountKey": "{...service account JSON...}"
}
```

**Response:**
```json
{
  "success": true,
  "triggers": [
    {
      "id": "trigger-id",
      "name": "trigger-name",
      "description": "...",
      "github": {...},
      "disabled": false
    }
  ],
  "count": 5
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket

2. Import project to Vercel:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Deploy:
```bash
vercel --prod
```

### Netlify

1. Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

2. Deploy:
```bash
netlify deploy --prod
```

3. Set environment variables in Netlify dashboard

### Self-Hosted

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

3. Or use PM2 for process management:
```bash
pm2 start npm --name "tandem" -- start
```

## Project Structure

```
tandem-nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes (server-side)
│   │   │   └── gcp/
│   │   │       └── triggers/
│   │   │           └── route.ts
│   │   ├── admin/             # Admin page
│   │   │   └── page.tsx
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Dashboard (homepage)
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── BookingForm.tsx
│   │   ├── Header.tsx
│   │   ├── IntegrationSettings.tsx
│   │   └── ResourceTable.tsx
│   ├── lib/                   # Utilities and services
│   │   ├── gcpService.ts
│   │   └── supabase.ts
│   ├── types/                 # TypeScript types
│   │   ├── index.ts
│   │   └── integrations.ts
│   └── utils/                 # Helper functions
│       └── dateUtils.ts
├── .env.local                 # Environment variables
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS config
├── tsconfig.json              # TypeScript config
└── package.json
```

## Key Features

### Realtime Synchronization
The application uses Supabase realtime subscriptions to provide instant updates:
- New bookings appear immediately for all users
- Resource status updates in real-time
- No manual refresh needed

### Soft Delete System
All deletions are soft deletes (setting `deleted_at` timestamp):
- Resources can be restored if needed
- Full audit trail maintained
- Active bookings prevented from deletion

### Cloud Build Integration
- Automatically syncs build triggers as resources
- Stores configuration in browser localStorage
- Server-side API calls to Google Cloud Build
- No credentials stored on server

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Adding New Integrations

To add support for AWS CodeBuild, Azure Pipelines, or other cloud providers:

1. Create a new service in `src/lib/` (e.g., `awsService.ts`)
2. Implement the `IntegrationProvider` interface
3. Add API route in `src/app/api/`
4. Add integration to Admin panel

Example:
```typescript
export const AWSCodeBuildIntegration: IntegrationProvider = {
  type: 'aws-codebuild',
  name: 'AWS CodeBuild',
  description: 'Sync AWS CodeBuild projects',
  // ... implementation
};
```

## Troubleshooting

### Build Errors

**Error: Missing Supabase environment variables**
- Ensure `.env.local` exists with correct values
- Check that variables start with `NEXT_PUBLIC_`

**Error: Tailwind CSS PostCSS plugin**
- Run: `npm install @tailwindcss/postcss`

### Runtime Errors

**Supabase connection fails**
- Verify Supabase URL and anon key are correct
- Check Supabase project status
- Ensure RLS policies allow public access

**Cloud Build API errors**
- Verify service account has correct permissions
- Check Project ID is correct
- Ensure Cloud Build API is enabled in GCP

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` to version control
2. **API Keys**: Supabase anon key should have RLS policies enabled
3. **Service Account Keys**: Stored client-side in localStorage (consider your security requirements)
4. **Row Level Security**: Enable RLS on Supabase tables for production

## License

MIT

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review Supabase and Next.js docs
