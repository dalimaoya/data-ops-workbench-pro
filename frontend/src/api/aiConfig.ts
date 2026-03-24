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
