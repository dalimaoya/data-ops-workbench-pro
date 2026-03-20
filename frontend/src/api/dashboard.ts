import { api } from './request';

export interface DashboardStats {
  datasource_count: number;
  table_count: number;
  today_export: number;
  today_import: number;
  today_writeback: number;
}

export interface RecentOperation {
  id: number;
  operation_type: string;
  operation_module: string;
  target_name: string | null;
  operation_status: string;
  operation_message: string | null;
  operator_user: string;
  created_at: string | null;
}

export interface Alert {
  type: string;
  level: string;
  title: string;
  message: string;
  target_id: number;
  target_name: string;
  created_at: string | null;
}

export const getDashboardStats = () =>
  api.get<DashboardStats>('/dashboard/stats');

export const getRecentOperations = () =>
  api.get<RecentOperation[]>('/dashboard/recent-operations');

export const getAlerts = () =>
  api.get<Alert[]>('/dashboard/alerts');
