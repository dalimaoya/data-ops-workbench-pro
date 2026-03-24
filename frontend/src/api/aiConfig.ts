import { api } from './request';

export interface AIConfigData {
  ai_enabled: boolean;
  engine_mode: string;
  platform_name: string;
  api_protocol: string;
  api_url: string;
  api_key_set: boolean;
  api_key_masked: string;
  model_name: string;
  max_tokens: number;
  temperature: number;
  feature_flags: Record<string, boolean>;
}

export interface AIConfigUpdateData {
  ai_enabled?: boolean;
  engine_mode?: string;
  platform_name?: string;
  api_protocol?: string;
  api_url?: string;
  api_key?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
  feature_flags?: Record<string, boolean>;
}

export interface AITestRequest {
  api_protocol?: string;
  api_url?: string;
  api_key?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AITestResult {
  ok: boolean;
  message: string;
}

export const getAIConfig = () =>
  api.get<AIConfigData>('/ai/config');

export const updateAIConfig = (data: AIConfigUpdateData) =>
  api.put<AIConfigData>('/ai/config', data);

export const testAIConnection = (data: AITestRequest) =>
  api.post<AITestResult>('/ai/config/test', data);

// ── AI Validate Config ──

export interface AIValidateConfig {
  outlier_range: string;
  history_sample_size: number;
  warning_behavior: string;
  skip_fields: string[];
}

export interface AIValidateConfigUpdate {
  outlier_range?: string;
  history_sample_size?: number;
  warning_behavior?: string;
  skip_fields?: string[];
}

export const getAIValidateConfig = () =>
  api.get<AIValidateConfig>('/ai/validate-config');

export const updateAIValidateConfig = (data: AIValidateConfigUpdate) =>
  api.put<AIValidateConfig>('/ai/validate-config', data);

// ── AI Data Validate ──

export interface AIWarning {
  row: number;
  column: string;
  value?: string;
  check_type: string;
  message: string;
  detail?: string;
  severity: string;
  historical_pattern?: string;
}

export interface AIValidateResult {
  warnings: AIWarning[];
  stats: {
    rows_checked: number;
    warnings_count: number;
    check_elapsed_ms: number;
    historical_rows: number;
  };
  warning_behavior?: string;
  message?: string;
}

export const aiDataValidate = (data: {
  table_id: number;
  import_data: Record<string, unknown>[];
  checks?: string[];
}) =>
  api.post<{ success: boolean; data: AIValidateResult }>('/ai/data-validate', data);
