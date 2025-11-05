# Tandem API Routes

This directory contains serverless API functions for Tandem integrations.

## Overview

The `/api` directory contains Next.js-style serverless functions that handle server-side operations like calling Cloud Build APIs. These functions use Node.js-only packages that cannot run in browsers.

## Structure

```
api/
└── gcp/
    └── triggers.js  - Fetches Cloud Build triggers from GCP
```

## Deployment

### Option 1: Vercel (Recommended)

Vercel automatically detects and deploys the `/api` folder as serverless functions.

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Your API will be available at:
   - `https://your-app.vercel.app/api/gcp/triggers`

### Option 2: Netlify

Netlify supports serverless functions with a slight configuration change.

1. Create `netlify.toml` in the project root:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
     functions = "api"

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

2. Deploy:
   ```bash
   netlify deploy --prod
   ```

### Option 3: Self-Hosted with Express

You can run the API routes with a simple Express server:

1. Create `server.js` in the project root:
   ```javascript
   const express = require('express');
   const cors = require('cors');
   const path = require('path');

   const app = express();
   app.use(cors());
   app.use(express.json());

   // Serve static files
   app.use(express.static('dist'));

   // Load API routes
   const gcpTriggers = require('./api/gcp/triggers');
   app.post('/api/gcp/triggers', gcpTriggers);

   // Serve React app for all other routes
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
   });

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

2. Add dependencies:
   ```bash
   npm install express cors
   ```

3. Run:
   ```bash
   node server.js
   ```

## API Endpoints

### POST /api/gcp/triggers

Fetches Cloud Build triggers from GCP.

**Request Body:**
```json
{
  "projectId": "your-gcp-project-id",
  "serviceAccountKey": "{\"type\":\"service_account\",...}"
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
      "description": "trigger description",
      "github": {
        "owner": "owner",
        "name": "repo",
        "branch": "main"
      },
      "disabled": false
    }
  ],
  "count": 1
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Development

During development, the API routes need to be served separately from the Vite dev server.

### Option 1: Use Vercel Dev (Easiest)

```bash
npx vercel dev
```

This starts both the Vite dev server and the API routes.

### Option 2: Separate Servers

1. Terminal 1 - Frontend:
   ```bash
   npm run dev
   ```

2. Terminal 2 - API (create a simple server):
   ```bash
   # TODO: Add dev server script
   ```

## Security Notes

⚠️ **Important**: The API routes receive service account credentials in the request body. In production:

1. **Never log credentials** - The API already includes proper error handling
2. **Use HTTPS** - Always deploy with SSL/TLS
3. **Add rate limiting** - Prevent abuse of your API endpoints
4. **Consider authentication** - Add API keys or JWT tokens to restrict access

### Recommended: Move Credentials Server-Side

Instead of sending credentials from the browser, store them server-side:

1. Set environment variables:
   ```bash
   # On Vercel/Netlify, add these as secrets
   GCP_PROJECT_ID=your-project-id
   GCP_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
   ```

2. Update `api/gcp/triggers.js`:
   ```javascript
   const projectId = process.env.GCP_PROJECT_ID;
   const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
   ```

3. Frontend only needs to call the API without credentials

## Adding New API Routes

1. Create a new file in `/api`:
   ```javascript
   // api/your-route.js
   module.exports = async (req, res) => {
     res.setHeader('Access-Control-Allow-Origin', '*');

     if (req.method === 'OPTIONS') {
       res.status(200).end();
       return;
     }

     try {
       // Your logic here
       res.status(200).json({ success: true });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   };
   ```

2. Frontend calls it:
   ```typescript
   const response = await fetch('/api/your-route', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ data: 'value' }),
   });
   ```

## Troubleshooting

### "Cannot find module '@google-cloud/cloudbuild'"

Make sure you've installed dependencies:
```bash
npm install
```

### "CORS error" in browser

Check that the API route includes CORS headers:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

### API route not found (404)

Verify your deployment platform supports the `/api` directory structure. Most platforms auto-detect it, but some may need configuration.

## Learn More

- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
