// Next.js API Route - Get Cloud Build Triggers
// This API route runs server-side and can use @google-cloud/cloudbuild

import { NextRequest, NextResponse } from 'next/server';
import { CloudBuildClient } from '@google-cloud/cloudbuild';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] === GCP Cloud Build API Request Started ===`);

  try {
    const body = await request.json();
    const { projectId, serviceAccountKey } = body;

    console.log(`[${requestId}] Project ID provided:`, projectId || '<missing>');

    if (!projectId) {
      console.error(`[${requestId}] ❌ Missing Project ID`);
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!serviceAccountKey) {
      console.error(`[${requestId}] ❌ Missing Service Account Key`);
      return NextResponse.json(
        { error: 'Service Account Key is required' },
        { status: 400 }
      );
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
      console.log(`[${requestId}] ✓ Service Account Key parsed successfully`);
      console.log(`[${requestId}] Service Account Email:`, credentials.client_email || '<not found>');
      console.log(`[${requestId}] Service Account Type:`, credentials.type || '<not found>');
      console.log(`[${requestId}] Service Account Project:`, credentials.project_id || '<not found>');

      // Validate required fields
      if (!credentials.client_email) {
        console.error(`[${requestId}] ❌ Missing client_email in service account key`);
      }
      if (!credentials.private_key) {
        console.error(`[${requestId}] ❌ Missing private_key in service account key`);
      }
      if (credentials.project_id && credentials.project_id !== projectId) {
        console.warn(`[${requestId}] ⚠️  Project ID mismatch: Request=${projectId}, ServiceAccount=${credentials.project_id}`);
      }
    } catch (error) {
      console.error(`[${requestId}] ❌ Failed to parse Service Account Key:`, error);
      return NextResponse.json(
        { error: 'Invalid service account key JSON' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Initializing Cloud Build client...`);

    // Initialize Cloud Build client
    const client = new CloudBuildClient({
      projectId,
      credentials,
    });

    console.log(`[${requestId}] ✓ Cloud Build client initialized`);
    console.log(`[${requestId}] Fetching build triggers for project: ${projectId}...`);

    // Fetch build triggers
    const [triggers] = await client.listBuildTriggers({
      projectId,
    });

    console.log(`[${requestId}] ✓ Successfully fetched ${triggers?.length || 0} triggers`);

    // Format triggers for frontend
    const formattedTriggers = (triggers || []).map((trigger: any) => ({
      id: trigger.id || '',
      name: trigger.name || '',
      description: trigger.description || '',
      filename: trigger.filename || '',
      github: trigger.github
        ? {
            owner: trigger.github.owner || '',
            name: trigger.github.name || '',
            branch: trigger.github.push?.branch || '',
          }
        : undefined,
      createTime: trigger.createTime || '',
      disabled: trigger.disabled || false,
    }));

    console.log(`[${requestId}] === Request Completed Successfully ===`);

    return NextResponse.json({
      success: true,
      triggers: formattedTriggers,
      count: formattedTriggers.length,
    });
  } catch (error: any) {
    console.error(`[${requestId}] === ERROR OCCURRED ===`);
    console.error(`[${requestId}] Error Type:`, error.constructor.name);
    console.error(`[${requestId}] Error Message:`, error.message);
    console.error(`[${requestId}] Error Code:`, error.code || '<no code>');
    console.error(`[${requestId}] Error Status:`, error.status || '<no status>');

    // Log gRPC specific errors
    if (error.code) {
      console.error(`[${requestId}] gRPC Status Code:`, error.code);
      console.error(`[${requestId}] gRPC Details:`, error.details || '<no details>');
    }

    // Check for permission errors
    if (error.code === 7 || error.message?.toLowerCase().includes('permission')) {
      console.error(`[${requestId}] ❌ PERMISSION DENIED ERROR DETECTED`);
      console.error(`[${requestId}] This usually means:`);
      console.error(`[${requestId}]   1. Service account doesn't have Cloud Build Viewer role`);
      console.error(`[${requestId}]   2. Cloud Build API is not enabled for the project`);
      console.error(`[${requestId}]   3. Service account key is invalid or expired`);
      console.error(`[${requestId}]   4. Project ID doesn't match the service account's project`);

      return NextResponse.json(
        {
          success: false,
          error: 'Permission Denied: Service account lacks necessary permissions',
          details: {
            message: error.message,
            code: error.code,
            troubleshooting: [
              'Verify the service account has "Cloud Build Viewer" role',
              'Ensure Cloud Build API is enabled in your GCP project',
              'Check that the service account key is valid and not expired',
              'Confirm the Project ID matches your service account\'s project'
            ]
          }
        },
        { status: 403 }
      );
    }

    // Log full error details for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${requestId}] Full Error Object:`, JSON.stringify(error, null, 2));
      console.error(`[${requestId}] Stack Trace:`, error.stack);
    }

    console.error(`[${requestId}] === Request Failed ===`);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch build triggers',
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: error.status || 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
