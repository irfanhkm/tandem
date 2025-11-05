// Vercel Serverless Function - Get Cloud Build Triggers
// This API route runs server-side and can use @google-cloud/cloudbuild

const { CloudBuildClient } = require('@google-cloud/cloudbuild');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, serviceAccountKey } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!serviceAccountKey) {
      return res.status(400).json({ error: 'Service Account Key is required' });
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKey);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid service account key JSON' });
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
    const formattedTriggers = (triggers || []).map((trigger) => ({
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

    res.status(200).json({
      success: true,
      triggers: formattedTriggers,
      count: formattedTriggers.length,
    });
  } catch (error) {
    console.error('Error fetching Cloud Build triggers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch build triggers',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
