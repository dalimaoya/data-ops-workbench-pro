import { api } from './request';

export interface MaintenanceTable {
  id: number;
  table_config_code: string;
  datasource_id: number;
  datasource_name?: string;
  db_type?: string;
  db_name?: string;
  schema_name?: string;
  table_name: string;
  table_alias?: string;
  config_version: number;
  structure_check_status?: string;
  field_count?: number;
  updated_by?: string;
  updated_at?: string;
}

export interface ColumnMeta {
  field_name: string;
  field_alias: string;
  db_data_type: string;
  is_primary_key: number;
  is_editable: number;
  is_system_field: number;
}

export interface BrowseResponse {
  columns: ColumnMeta[];
  rows: Record<string, string | null>[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExportInfo {
  table_config_id: number;
  table_alias?: string;
  table_name: string;
  config_version: number;
  field_count: number;
  estimated_rows: number;
}

export interface ImportResult {
  task_id: number;
  import_batch_no: string;
  validation_status: string;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  diff_count: number;
  errors: Array<{
    row: number;
    field: string;
    type: string;
    value?: string;
    message: string;
  }>;
  warnings_list: Array<{
    row: number;
    field: string;
    type: string;
    message: string;
  }>;
}

export interface DiffRow {
  row_num: number;
  pk_key: string;
  field_name: string;
  field_alias: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
}

export interface DiffResponse {
  task_id: number;
  import_batch_no: string;
  table_config_id: number;
  table_name?: string;
  table_alias?: string;
  config_version?: number;
  operator_user?: string;
  import_time?: string;
  total_rows: number;
  passed_rows: number;
  failed_rows: number;
  diff_count: number;
  diff_rows: DiffRow[];
  validation_status: string;
}

export interface WritebackResult {
  writeback_batch_no: string;
  backup_version_no: string;
  status: string;
  total: number;
  success: number;
  failed: number;
  backup_table: string;
  backup_record_count: number;
  operator_user: string;
  started_at: string;
  finished_at: string;
  failed_details: Array<{ row_num: number; pk_key: string; error: string }>;
}

export interface ImportTaskDetail {
  task_id: number;
  import_batch_no: string;
  table_config_id: number;
  datasource_id: number;
  import_file_name: string;
  template_version?: number;
  total_row_count: number;
  passed_row_count: number;
  warning_row_count: number;
  failed_row_count: number;
  diff_row_count: number;
  validation_status: string;
  validation_message?: string;
  import_status: string;
  operator_user: string;
  created_at?: string;
  errors: Array<{
    row: number;
    field: string;
    type: string;
    value?: string;
    message: string;
  }>;
}

// 可维护表列表
export const listMaintenanceTables = (params?: Record<string, unknown>) =>
  api.get<{ total: number; items: MaintenanceTable[] }>('/data-maintenance/tables', { params });

// 浏览表数据
export const browseTableData = (tableConfigId: number, params?: Record<string, unknown>) =>
  api.get<BrowseResponse>(`/data-maintenance/${tableConfigId}/data`, { params });

// 导出预估信息
export const getExportInfo = (tableConfigId: number) =>
  api.get<ExportInfo>(`/data-maintenance/${tableConfigId}/export-info`);

// 导出模板（返回文件下载）
export const exportTemplate = (tableConfigId: number, params?: Record<string, unknown>) =>
  api.post(`/data-maintenance/${tableConfigId}/export`, null, {
    params,
    responseType: 'blob',
  });

// 导入模板
export const importTemplate = (tableConfigId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<ImportResult>(`/data-maintenance/${tableConfigId}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// 导入任务详情
export const getImportTask = (taskId: number) =>
  api.get<ImportTaskDetail>(`/data-maintenance/import-tasks/${taskId}`);

// 差异预览
export const getImportDiff = (taskId: number) =>
  api.get<DiffResponse>(`/data-maintenance/import-tasks/${taskId}/diff`);

// 执行回写
export const executeWriteback = (taskId: number) =>
  api.post<WritebackResult>(`/data-maintenance/import-tasks/${taskId}/writeback`);
