# Tandem - Environment Coordination Platform

Tandem is a simple web application that helps engineering teams coordinate shared test environments (QA, Staging, UAT) by providing visibility, booking, and management capabilities.

## Features

- 🔒 **Resource Booking** - Book environments with your name, branch, notes, and expiry time
- 📊 **Real-time Dashboard** - See who's using what, with live updates
- ⏰ **Auto-release** - Bookings automatically release when expired
- 🏷️ **Label Filtering** - Filter resources by tags (qa, uat, service names)
- 🚫 **No Authentication** - Simple trust-based system for small teams
- 📝 **Audit Trail** - Complete history of all booking actions

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Routing**: React Router v6
- **Date Utilities**: date-fns
- **Deployment**: Vercel (or any static hosting)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → New Query
3. Copy and paste the entire contents of `supabase-schema.sql`
4. Click **Run** to create all tables and functions

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Supabase credentials:
# (Find these in Supabase: Settings → API)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Add Resources

1. Navigate to **Admin** (in the header)
2. Click **Add Resource**
3. Add your environments:
   - Name: `qa-environment-1`
   - Labels: `qa, testing`
4. Click **Create**

### 6. Start Booking!

1. Go to **Dashboard**
2. Click any **Free** resource
3. Enter:
   - **Your Name** (required)
   - **Branch Name** (required)
   - **Expiry Time** (use presets or custom)
   - Notes and build link (optional)
4. Click **Book**
5. Resource is now locked to you!

## How It Works

### No Authentication
- **No login required** - Just open the app and start using it
- **Trust-based system** - Users enter their own name when booking
- **Perfect for small teams** - Simple and fast, no OAuth setup

### Booking Flow

**To Book:**
1. Click a Free resource
2. Enter your name + branch details
3. Select expiry time (1h, 2h, 4h, or custom)
4. Click Book

**To Release:**
1. Click the locked resource
2. Click Release button
3. Resource is Free again

**To Extend:**
1. Click the locked resource
2. Click Extend
3. Choose +1h, +2h, +4h, or select custom time

### Dashboard
Shows all resources with:
- Resource name and labels
- Status (🟢 Free / 🔴 Locked)
- Who booked it (by name)
- Branch name
- Expiry time
- When it was booked

### Admin Panel
- Create/Edit/Delete resources
- Manage resource labels
- No restrictions - everyone can access

## Auto-Release Setup

Expired bookings are automatically released using a PostgreSQL function. To enable:

### Option 1: Supabase Edge Function (Recommended)

Create a Supabase Edge Function:

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

Deploy and set up a cron trigger in Supabase dashboard.

### Option 2: External Cron Service

Use [cron-job.org](https://cron-job.org) (free):

1. Create account
2. Create new cron job:
   - URL: `https://YOUR-PROJECT.supabase.co/rest/v1/rpc/auto_release_expired_bookings`
   - Method: POST
   - Headers:
     - `apikey: YOUR_SUPABASE_ANON_KEY`
     - `Content-Type: application/json`
   - Schedule: Every minute

### Option 3: pg_cron Extension

If available in your Supabase plan:

```sql
SELECT cron.schedule(
  'auto-release',
  '* * * * *',
  'SELECT auto_release_expired_bookings()'
);
```

## Database Schema

- **resources**: Environments/triggers available for booking
- **bookings**: Active bookings (one per resource)
- **booking_history**: Audit trail of all actions

See `supabase-schema.sql` for complete schema.

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

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Deploy to Netlify

```bash
npm run build
# Upload dist/ folder to Netlify
```

Add the same environment variables in Netlify dashboard.

## Troubleshooting

### Resources not showing

- Check Supabase RLS policies are applied
- Verify environment variables are set correctly
- Check browser console for API errors

### Styles not loading

- Clear browser cache
- Rebuild: `npm run build`
- Check if Tailwind CSS is working: `npm list tailwindcss`

### Auto-release not working

- Verify PostgreSQL function is created: Run `SELECT auto_release_expired_bookings();` in Supabase SQL Editor
- Check cron job is running (check Supabase Functions logs)
- Test manually in SQL Editor

## Phase 2: Google Cloud Build Integration

Coming soon! We'll add:
- Fetch build triggers from GCP
- Display latest build info per resource
- Trigger builds directly from Tandem
- Auto-book on build start

## License

[To be determined - likely MIT or Apache 2.0]

## Support

For issues or questions, check the documentation or contact your team admin.

---

Built for better environment coordination 🚀
