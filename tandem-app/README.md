# Tandem - Environment Coordination Platform

Tandem is a web application that helps engineering teams coordinate shared test environments (QA, Staging, UAT) by providing visibility, booking, and management capabilities.

## Features

- 🔒 **Resource Booking** - Book environments with branch name, notes, and expiry time
- 📊 **Real-time Dashboard** - See who's using what, with live updates
- ⏰ **Auto-release** - Bookings automatically release when expired
- 🏷️ **Label Filtering** - Filter resources by tags (qa, uat, service names)
- 🔐 **Google OAuth** - Secure authentication via Google
- 👥 **Role-based Access** - User and Admin roles
- 📝 **Audit Trail** - Complete history of all booking actions

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Routing**: React Router v6
- **Date Utilities**: date-fns
- **Deployment**: Vercel (or any static hosting)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Google Cloud Console project (for OAuth)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd tandem-app
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire `supabase-schema.sql` file
3. Go to **Authentication > Providers** and enable Google OAuth:
   - Add your Google Client ID and Secret (see step 3)
   - Add authorized redirect URLs (e.g., `http://localhost:5173` for dev)
4. Go to **Settings > API** and copy:
   - Project URL
   - Anon/Public Key

### 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure OAuth consent screen
6. Add Authorized redirect URIs:
   - For Supabase: `https://<your-project>.supabase.co/auth/v1/callback`
   - For local dev: `http://localhost:5173` (optional)
7. Copy **Client ID** and **Client Secret**
8. Add them to Supabase (step 2.3 above)

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 6. Create First Admin User

After first login:

1. Go to Supabase dashboard
2. Navigate to **Table Editor** > **users** table
3. Find your user and update the `role` column to `ADMIN`
4. Refresh the app - you should now see the "Admin" link in the header

### 7. Add Resources (Environments)

1. Click "Admin" in the header
2. Click "Add Resource"
3. Add your environments:
   - Name: `qa-environment-1`
   - Labels: `qa, order-service`
4. Repeat for all your environments

## Usage

### For Users

1. **View Dashboard**: See all resources and their status (Free/Locked)
2. **Book Resource**: Click a Free resource → Fill branch name → Select expiry → Book
3. **Release Resource**: Click your locked resource → Release button
4. **Extend Booking**: Click your locked resource → Extend → Choose new expiry
5. **Edit Details**: Click your locked resource → Edit → Update notes/build link

### For Admins

All user permissions, plus:

1. **Manage Resources**: Admin panel to create/edit/delete resources
2. **Release Any Booking**: Can release other users' bookings
3. **Extend Any Booking**: Can extend other users' bookings

## Auto-Release Setup

Expired bookings are automatically released using a PostgreSQL function. To enable automatic execution:

### Option 1: Supabase Edge Function (Recommended)

Create a Supabase Edge Function with cron trigger:

```typescript
// supabase/functions/auto-release/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabaseAdmin.rpc('auto_release_expired_bookings')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Deploy and set up cron trigger in Supabase dashboard.

### Option 2: External Cron Service

Use services like:
- **Vercel Cron** (if deployed on Vercel)
- **GitHub Actions** (scheduled workflow)
- **Cron-job.org** (free external service)

Call the function via Supabase REST API:

```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/auto_release_expired_bookings' \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Option 3: pg_cron Extension

If your Supabase plan includes pg_cron:

```sql
SELECT cron.schedule(
  'auto-release-bookings',
  '* * * * *', -- Every minute
  'SELECT auto_release_expired_bookings()'
);
```

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard.

### Deploy to Netlify

```bash
npm run build
# Upload dist/ folder to Netlify
```

Add environment variables in Netlify dashboard.

## Database Schema

- **users**: User profiles linked to Supabase Auth
- **resources**: Environments/triggers available for booking
- **bookings**: Active bookings (one per resource)
- **booking_history**: Audit trail of all actions

See `supabase-schema.sql` for complete schema and RLS policies.

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Troubleshooting

### Login not working

- Check Google OAuth credentials in Supabase
- Verify redirect URLs are correct
- Check browser console for errors

### Resources not showing

- Check Supabase RLS policies are applied
- Verify user is logged in
- Check browser console for API errors

### Auto-release not working

- Verify the PostgreSQL function is created (`auto_release_expired_bookings`)
- Check cron job is running (check Supabase Functions logs)
- Test function manually: `SELECT auto_release_expired_bookings();`

## Phase 2: Google Cloud Build Integration

Coming soon! We'll add:
- Fetch build triggers from GCP
- Display latest build info per resource
- Trigger builds directly from Tandem
- Auto-book on build start

## Contributing

This is a private project during Phase 1. Will open source in Phase 3+.

## License

[To be determined - likely MIT or Apache 2.0]

## Support

For issues or questions, contact [Your Team/Email].

---

Built with ❤️ for better environment coordination
