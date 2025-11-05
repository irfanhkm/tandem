// Next.js API Route - Get Cloud Build Triggers
// This API route runs server-side and can use @google-cloud/cloudbuild

import { NextRequest, NextResponse } from 'next/server';
import { CloudBuildClient } from '@google-cloud/cloudbuild';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, serviceAccountKey } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'Service Account Key is required' },
        { status: 400 }
      );
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid service account key JSON' },
        { status: 400 }
      );
    }

    // Initialize Cloud Build client
    const client = new CloudBuildClient({
      projectId,
      credentials,
    });

    // Fetch build triggers
    const [triggers] = await client.listBuildTriggers({
      projectId,
    });

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

    return NextResponse.json({
      success: true,
      triggers: formattedTriggers,
      count: formattedTriggers.length,
    });
  } catch (error: any) {
    console.error('Error fetching Cloud Build triggers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch build triggers',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
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
