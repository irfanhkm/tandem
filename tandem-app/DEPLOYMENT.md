# Deployment Guide

This guide covers deploying Tandem to various platforms with Next.js.

## Quick Start

1. Build the application:
```bash
npm run build
```

2. Test locally:
```bash
npm start
```

3. Deploy to your preferred platform (see below)

## Platform-Specific Guides

### Vercel (Recommended)

Vercel is the recommended platform as it's built by the creators of Next.js and provides seamless integration.

#### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

#### Manual Deploy

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```

4. **Set Environment Variables** in Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

5. **Deploy to Production**:
```bash
vercel --prod
```

#### Vercel Configuration

Create `vercel.json` (optional):
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### Netlify

1. **Install Netlify CLI**:
```bash
npm i -g netlify-cli
```

2. **Create `netlify.toml`**:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

3. **Login and Deploy**:
```bash
netlify login
netlify init
netlify deploy --prod
```

4. **Set Environment Variables**:
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-url"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-key"
```

Or via Netlify Dashboard → Site Settings → Environment Variables

### AWS Amplify

1. **Push code to Git repository** (GitHub, GitLab, Bitbucket)

2. **Create Amplify App**:
   - Go to AWS Amplify Console
   - Click "New app" → "Host web app"
   - Connect your repository
   - Select the branch

3. **Configure Build Settings**:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

4. **Add Environment Variables**:
   - Go to App Settings → Environment Variables
   - Add Supabase credentials

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  tandem:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    restart: unless-stopped
```

Build and run:
```bash
docker build -t tandem .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="your-url" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your-key" \
  tandem
```

Or with Docker Compose:
```bash
docker-compose up -d
```

### Self-Hosted (Linux Server)

#### Using PM2 (Process Manager)

1. **Install PM2**:
```bash
npm install -g pm2
```

2. **Create ecosystem file** `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'tandem',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/tandem-nextjs',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_PUBLIC_SUPABASE_URL: 'your-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your-key'
    },
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

3. **Start with PM2**:
```bash
cd /path/to/tandem-nextjs
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Using systemd

1. **Create systemd service** `/etc/systemd/system/tandem.service`:
```ini
[Unit]
Description=Tandem Next.js Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/tandem-nextjs
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="NEXT_PUBLIC_SUPABASE_URL=your-url"
Environment="NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. **Enable and start**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tandem
sudo systemctl start tandem
sudo systemctl status tandem
```

#### Nginx Reverse Proxy

1. **Create Nginx config** `/etc/nginx/sites-available/tandem`:
```nginx
server {
    listen 80;
    server_name tandem.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

2. **Enable and reload**:
```bash
sudo ln -s /etc/nginx/sites-available/tandem /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

3. **Add SSL with Let's Encrypt**:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tandem.yourdomain.com
```

### Railway

1. **Push code to GitHub**

2. **Go to Railway.app**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add Environment Variables**:
   - Click on your service → Variables
   - Add Supabase credentials

4. **Deploy**: Railway will automatically detect Next.js and deploy

### Render

1. **Create `render.yaml`**:
```yaml
services:
  - type: web
    name: tandem
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_SUPABASE_URL
        sync: false
      - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
        sync: false
```

2. **Deploy**:
   - Go to Render Dashboard
   - New → Web Service
   - Connect GitHub repository
   - Add environment variables

## Environment Variables

All platforms require these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key |
| `NODE_ENV` | Auto | Set to `production` automatically |
| `PORT` | No | Server port (default: 3000) |

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test the application URL
- [ ] Check API routes work (`/api/gcp/triggers`)
- [ ] Verify Supabase connection
- [ ] Test Cloud Build integration
- [ ] Check realtime updates work
- [ ] Monitor application logs
- [ ] Set up custom domain (if applicable)
- [ ] Configure SSL certificate
- [ ] Set up monitoring/alerts

## Troubleshooting

### Build Fails

**Issue**: `Missing Supabase environment variables`
**Solution**: Add environment variables to your deployment platform

**Issue**: `Module not found` errors
**Solution**: Run `npm ci` to ensure clean dependency install

### Runtime Issues

**Issue**: 500 errors on API routes
**Solution**: Check logs for Cloud Build API errors, verify service account permissions

**Issue**: Realtime not working
**Solution**: Ensure Supabase realtime is enabled for tables

### Performance

**Issue**: Slow page loads
**Solution**:
- Enable ISR (Incremental Static Regeneration)
- Add Redis caching
- Use CDN for static assets
- Optimize images with Next.js Image component

## Scaling

### Horizontal Scaling

Most platforms auto-scale:
- **Vercel**: Automatic
- **Netlify**: Automatic
- **AWS Amplify**: Automatic
- **Docker**: Use Kubernetes or Docker Swarm

### Database Scaling

For high traffic, consider:
1. **Supabase Pro Plan**: Better performance and connection pooling
2. **Read Replicas**: For read-heavy workloads
3. **Connection Pooling**: PgBouncer (included in Supabase)

### Caching Strategy

Implement caching for API routes:
```typescript
// In API route
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds
```

## Monitoring

### Vercel Analytics

Enable in `next.config.ts`:
```typescript
import { withAnalytics } from '@vercel/analytics';

export default withAnalytics({
  // ... your config
});
```

### Custom Monitoring

Add services like:
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Datadog**: APM and logs
- **New Relic**: Performance monitoring

## Support

For deployment issues:
1. Check platform-specific documentation
2. Review application logs
3. Test locally first with `npm run build && npm start`
4. Verify all environment variables are set
