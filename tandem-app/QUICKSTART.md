# Tandem - Quick Start Guide

Get Tandem running in 10 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → Create a new project
2. Wait for project to initialize (~2 minutes)
3. Go to **SQL Editor** → New Query
4. Copy and paste entire contents of `supabase-schema.sql`
5. Click "Run" to execute

## 3. Enable Google OAuth

1. In Supabase: **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Copy the "Authorized redirect URIs" shown (you'll need this)

4. Go to [Google Cloud Console](https://console.cloud.google.com)
5. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
6. Choose "Web application"
7. Add authorized redirect URI from step 3
8. Copy Client ID and Client Secret

9. Back in Supabase, paste Client ID and Secret
10. Click "Save"

## 4. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Supabase credentials:
# (Find these in Supabase: Settings → API)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 5. Start the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 6. First Login & Setup

1. Click "Sign in with Google"
2. After login, you'll see an empty dashboard

3. **Make yourself an admin:**
   - Go to Supabase → **Table Editor** → **users**
   - Find your email → Click edit → Change `role` to `ADMIN`
   - Refresh the app → You should see "Admin" link in header

4. **Add your first resource:**
   - Click "Admin" in header
   - Click "Add Resource"
   - Name: `qa-environment-1`
   - Labels: `qa, testing`
   - Click "Create"

5. **Test booking:**
   - Go back to Dashboard (click "Dashboard" in header)
   - Click the resource you just created
   - Fill in branch name: `test/my-feature`
   - Select expiry: 2 hours
   - Click "Book"
   - Resource should now show as Locked!

## 7. Set Up Auto-Release (Optional but Recommended)

### Option A: Supabase Cron (Easiest)

1. In Supabase: **Database** → **Cron Jobs** (if available in your plan)
2. Create new cron job:
   ```sql
   SELECT cron.schedule(
     'auto-release',
     '* * * * *',
     'SELECT auto_release_expired_bookings()'
   );
   ```

### Option B: External Service

Use [cron-job.org](https://cron-job.org) (free):

1. Create account
2. Create new cron job:
   - URL: `https://YOUR-PROJECT.supabase.co/rest/v1/rpc/auto_release_expired_bookings`
   - Method: POST
   - Headers:
     - `apikey: YOUR_SUPABASE_ANON_KEY`
     - `Content-Type: application/json`
   - Schedule: Every minute

## 🎉 You're Done!

Your team can now:
- Book environments before deploying
- See who's using what
- Prevent deployment collisions
- Have full visibility into environment usage

## Next Steps

- Add all your environments as resources (Admin panel)
- Invite your team (they can sign in with Google)
- Set up labels for easier filtering (qa, uat, staging, service names)

## Need Help?

- Check the full README.md for detailed documentation
- Check Supabase logs if something isn't working
- Test the auto-release function manually: Go to Supabase SQL Editor and run:
  ```sql
  SELECT auto_release_expired_bookings();
  ```

## Phase 2 Preview

Coming soon:
- Automatic import of Google Cloud Build triggers as resources
- Display latest build info for each environment
- One-click build triggering from Tandem

Stay tuned!
