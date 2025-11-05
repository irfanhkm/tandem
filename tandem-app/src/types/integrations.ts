// Integration Types and Abstractions
// This allows for multiple cloud providers and services

export type IntegrationType = 'gcp-cloud-build' | 'aws-codebuild' | 'azure-pipelines' | 'jenkins';

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  name: string;
  description: string;
  settings: Record<string, any>;
}

export interface SyncResult {
  success: number;
  skipped: number;
  errors: string[];
}

export interface IntegrationProvider {
  type: IntegrationType;
  name: string;
  description: string;

  // Check if the integration is properly configured
  isConfigured(): boolean;

  // Validate configuration
  validateConfig(settings: Record<string, any>): { valid: boolean; errors: string[] };

  // Sync resources from external service to Tandem
  syncResources(): Promise<SyncResult>;

  // Get configuration form fields
  getConfigFields(): ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'password' | 'select';
  placeholder?: string;
  required: boolean;
  description?: string;
  options?: { value: string; label: string }[];
}

// LocalStorage keys
export const INTEGRATION_STORAGE_KEY = 'tandem_integrations';

// Helper functions for localStorage management
export function getIntegrationConfig(type: IntegrationType): IntegrationConfig | null {
  try {
    const stored = localStorage.getItem(INTEGRATION_STORAGE_KEY);
    if (!stored) return null;

    const configs: IntegrationConfig[] = JSON.parse(stored);
    return configs.find(c => c.type === type) || null;
  } catch (error) {
    console.error('Error reading integration config:', error);
    return null;
  }
}

export function saveIntegrationConfig(config: IntegrationConfig): void {
  try {
    const stored = localStorage.getItem(INTEGRATION_STORAGE_KEY);
    let configs: IntegrationConfig[] = stored ? JSON.parse(stored) : [];

    // Remove existing config for this type
    configs = configs.filter(c => c.type !== config.type);

    // Add new config
    configs.push(config);

    localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Error saving integration config:', error);
  }
}

export function deleteIntegrationConfig(type: IntegrationType): void {
  try {
    const stored = localStorage.getItem(INTEGRATION_STORAGE_KEY);
    if (!stored) return;

    let configs: IntegrationConfig[] = JSON.parse(stored);
    configs = configs.filter(c => c.type !== type);

    localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Error deleting integration config:', error);
  }
}

export function getAllIntegrations(): IntegrationConfig[] {
  try {
    const stored = localStorage.getItem(INTEGRATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading integrations:', error);
    return [];
  }
}
