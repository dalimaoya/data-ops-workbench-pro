import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tabs, Input, Select, DatePicker, Button, Tag, Row, Col, message, Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  listSystemLogs, listExportLogs, listImportLogs, listWritebackLogs, listFieldChanges,
  type SystemLog, type ExportLog, type ImportLog, type WritebackLogItem, type FieldChangeItem,
} from '../../api/logs';
import { listDatasources } from '../../api/datasource';
import { listExportTasks, downloadExportTask, retryImportValidation, type ExportTaskItem } from '../../api/dataMaintenance';
import { useNavigate as useLogNavigate } from 'react-router-dom';
import { formatBeijingTime } from '../../utils/formatTime';
import { useTranslation } from 'react-i18next';

const { RangePicker } = DatePicker;

// ─── Shared Filter Bar ───
function FilterBar({
  dsOptions, filters, setFilters, onSearch, onReset, extraFields,
}: {
  dsOptions: { value: number; label: string }[];
  filters: Record<string, any>;
  setFilters: (f: Record<string, any>) => void;
  onSearch: () => void;
  onReset: () => void;
  extraFields?: React.ReactNode;
}) {
  return (
    <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
      <Col>
        <Select placeholder="数据源" allowClear style={{ width: 180 }}
          options={dsOptions} value={filters.datasource_id}
          onChange={v => setFilters({ ...filters, datasource_id: v })}
        />
      </Col>
      <Col>
        <Input placeholder="表名" allowClear style={{ width: 140 }}
          value={filters.table_name}
          onChange={e => setFilters({ ...filters, table_name: e.target.value })}
        />
      </Col>
      {extraFields}
      <Col>
        <Input placeholder="操作人" allowClear style={{ width: 120 }}
          value={filters.operator_user}
          onChange={e => setFilters({ ...filters, operator_user: e.target.value })}
        />
      </Col>
      <Col>
        <RangePicker showTime value={filters.timeRange}
          onChange={v => setFilters({ ...filters, timeRange: v })}
        />
      </Col>
      <Col><Button type="primary" onClick={onSearch}>查询</Button></Col>
      <Col><Button onClick={onReset}>重置</Button></Col>
    </Row>
  );
}

const statusTag = (s: string) => {
  const colorMap: Record<string, string> = {
    success: 'green', failed: 'red', partial: 'orange', warning: 'gold',
    running: 'blue', validated: 'cyan', uploaded: 'default', confirmed: 'green',
  };
  return <Tag color={colorMap[s] || 'default'}>{s}</Tag>;
};

const changeTypeTag = (s: string) => {
  const map: Record<string, { color: string; text: string }> = {
    update: { color: 'orange', text: '更新' },
    insert: { color: 'green', text: '新增' },
    delete: { color: 'red', text: '删除' },
  };
  const info = map[s] || { color: 'default', text: s };
  return <Tag color={info.color}>{info.text}</Tag>;
};

// ─── System Logs Tab ───
function SystemLogTab({ dsOptions: _dsOptions }: { dsOptions: { value: number; label: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const defaultFilters = { datasource_id: undefined, table_name: '', operator_user: '', timeRange: null, operation_module: '', operation_type: '', operation_status: undefined };
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (filters.operation_module) params.operation_module = filters.operation_module;
      if (filters.operation_type) params.operation_type = filters.operation_type;
      if (filters.operator_user) params.operator_user = filters.operator_user;
      if (filters.operation_status) params.operation_status = filters.operation_status;
      if (filters.timeRange) {
        params.start_time = filters.timeRange[0].format('YYYY-MM-DDTHH:mm:ss');
        params.end_time = filters.timeRange[1].format('YYYY-MM-DDTHH:mm:ss');
      }
      const res = await listSystemLogs(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch { message.error('加载系统日志失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnsType<SystemLog> = [
    { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    { title: '模块', dataIndex: 'operation_module', width: 120 },
    { title: '操作类型', dataIndex: 'operation_type', width: 120 },
    { title: '目标', dataIndex: 'target_name', width: 180 },
    { title: '状态', dataIndex: 'operation_status', width: 90, render: v => statusTag(v) },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '详情', dataIndex: 'operation_message', ellipsis: true },
  ];

  return (
    <>
      <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Select placeholder="模块" allowClear style={{ width: 150 }}
            options={['数据源管理','纳管表配置','数据维护'].map(v => ({ value: v, label: v }))}
            value={filters.operation_module || undefined}
            onChange={v => setFilters({ ...filters, operation_module: v })}
          />
        </Col>
        <Col>
          <Input placeholder="操作类型" allowClear style={{ width: 140 }}
            value={filters.operation_type}
            onChange={e => setFilters({ ...filters, operation_type: e.target.value })}
          />
        </Col>
        <Col>
          <Input placeholder="操作人" allowClear style={{ width: 120 }}
            value={filters.operator_user}
            onChange={e => setFilters({ ...filters, operator_user: e.target.value })}
          />
        </Col>
        <Col>
          <Select placeholder="状态" allowClear style={{ width: 120 }}
            options={['success','failed','warning'].map(v => ({ value: v, label: v }))}
            value={filters.operation_status}
            onChange={v => setFilters({ ...filters, operation_status: v })}
          />
        </Col>
        <Col>
          <RangePicker showTime value={filters.timeRange}
            onChange={v => setFilters({ ...filters, timeRange: v })}
          />
        </Col>
        <Col><Button type="primary" onClick={() => { setPage(1); fetchData(); }}>查询</Button></Col>
        <Col><Button onClick={() => { setFilters(defaultFilters); setPage(1); }}>重置</Button></Col>
      </Row>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        scroll={{ x: 900 }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20','50','100'], showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </>
  );
}

// ─── Export Logs Tab ───
function ExportLogTab({ dsOptions }: { dsOptions: { value: number; label: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExportLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const defaultFilters = { datasource_id: undefined, table_name: '', operator_user: '', timeRange: null };
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (filters.datasource_id) params.datasource_id = filters.datasource_id;
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.operator_user) params.operator_user = filters.operator_user;
      if (filters.timeRange) {
        params.start_time = filters.timeRange[0].format('YYYY-MM-DDTHH:mm:ss');
        params.end_time = filters.timeRange[1].format('YYYY-MM-DDTHH:mm:ss');
      }
      const res = await listExportLogs(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch { message.error('加载导出日志失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnsType<ExportLog> = [
    { title: '批次号', dataIndex: 'export_batch_no', width: 200 },
    { title: '数据源', dataIndex: 'datasource_name', width: 150 },
    { title: '表名', dataIndex: 'table_name', width: 140, render: (v, r) => r.table_alias ? `${r.table_alias}（${v}）` : v },
    { title: '导出类型', dataIndex: 'export_type', width: 100 },
    { title: '行数', dataIndex: 'row_count', width: 80 },
    { title: '字段数', dataIndex: 'field_count', width: 80 },
    { title: '文件名', dataIndex: 'file_name', width: 200, ellipsis: true },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => formatBeijingTime(v) },
  ];

  return (
    <>
      <FilterBar dsOptions={dsOptions} filters={filters} setFilters={setFilters}
        onSearch={() => { setPage(1); fetchData(); }}
        onReset={() => { setFilters(defaultFilters); setPage(1); }}
      />
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20','50','100'], showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </>
  );
}

// ─── Import Logs Tab ───
function ImportLogTab({ dsOptions, onRetryNavigate }: { dsOptions: { value: number; label: string }[]; onRetryNavigate?: (taskId: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImportLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const defaultFilters = { datasource_id: undefined, table_name: '', operator_user: '', timeRange: null, validation_status: undefined };
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (filters.datasource_id) params.datasource_id = filters.datasource_id;
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.operator_user) params.operator_user = filters.operator_user;
      if (filters.validation_status) params.validation_status = filters.validation_status;
      if (filters.timeRange) {
        params.start_time = filters.timeRange[0].format('YYYY-MM-DDTHH:mm:ss');
        params.end_time = filters.timeRange[1].format('YYYY-MM-DDTHH:mm:ss');
      }
      const res = await listImportLogs(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch { message.error('加载导入日志失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [retrying, setRetrying] = useState<number | null>(null);

  const handleRetry = async (taskId: number) => {
    setRetrying(taskId);
    try {
      const res = await retryImportValidation(taskId);
      const result = res.data;
      message.success('重新校验完成');
      fetchData();
      // Navigate to diff preview of the new task
      if (onRetryNavigate && result.task_id) {
        onRetryNavigate(result.task_id);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '重新校验失败';
      message.error(msg);
    } finally {
      setRetrying(null);
    }
  };

  const columns: ColumnsType<ImportLog> = [
    { title: '批次号', dataIndex: 'import_batch_no', width: 200 },
    { title: '数据源', dataIndex: 'datasource_name', width: 150 },
    { title: '表名', dataIndex: 'table_name', width: 140, render: (v, r) => r.table_alias ? `${r.table_alias}（${v}）` : v },
    { title: '文件名', dataIndex: 'import_file_name', width: 200, ellipsis: true },
    { title: '总行数', dataIndex: 'total_row_count', width: 80 },
    { title: '通过', dataIndex: 'passed_row_count', width: 80 },
    { title: '失败', dataIndex: 'failed_row_count', width: 80 },
    { title: '校验状态', dataIndex: 'validation_status', width: 100, render: v => statusTag(v) },
    { title: '导入状态', dataIndex: 'import_status', width: 100, render: v => statusTag(v) },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    {
      title: '操作', width: 100, fixed: 'right',
      render: (_: unknown, record: ImportLog) => {
        if (record.validation_status === 'failed' || record.validation_status === 'partial') {
          return (
            <Button
              type="link"
              size="small"
              loading={retrying === record.id}
              onClick={() => handleRetry(record.id)}
            >
              重新校验
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <FilterBar dsOptions={dsOptions} filters={filters} setFilters={setFilters}
        onSearch={() => { setPage(1); fetchData(); }}
        onReset={() => { setFilters(defaultFilters); setPage(1); }}
        extraFields={
          <Col>
            <Select placeholder="校验状态" allowClear style={{ width: 130 }}
              options={['success','failed','partial'].map(v => ({ value: v, label: v }))}
              value={filters.validation_status}
              onChange={v => setFilters({ ...filters, validation_status: v })}
            />
          </Col>
        }
      />
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20','50','100'], showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </>
  );
}

// ─── Field Change Detail Modal ───
function FieldChangeModal({
  writebackLogId, open, onClose,
}: {
  writebackLogId: number; open: boolean; onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FieldChangeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [fieldNameFilter, setFieldNameFilter] = useState('');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    if (!open || !writebackLogId) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (fieldNameFilter) params.field_name = fieldNameFilter;
      if (changeTypeFilter) params.change_type = changeTypeFilter;
      const res = await listFieldChanges(writebackLogId, params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('加载变更明细失败');
    } finally {
      setLoading(false);
    }
  }, [writebackLogId, open, page, pageSize, fieldNameFilter, changeTypeFilter]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchData();
    }
  }, [open, writebackLogId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnsType<FieldChangeItem> = [
    { title: '行主键', dataIndex: 'row_pk_value', width: 180 },
    { title: '字段名', dataIndex: 'field_name', width: 150 },
    {
      title: '原值', dataIndex: 'old_value', ellipsis: true,
      render: (v: string | null) => v !== null ? <span style={{ color: '#999' }}>{v}</span> : <span style={{ color: '#ccc', fontStyle: 'italic' }}>NULL</span>,
    },
    {
      title: '新值', dataIndex: 'new_value', ellipsis: true,
      render: (v: string | null) => v !== null ? <span style={{ color: '#1890ff', fontWeight: 500 }}>{v}</span> : <span style={{ color: '#ccc', fontStyle: 'italic' }}>NULL</span>,
    },
    { title: '变更类型', dataIndex: 'change_type', width: 90, render: v => changeTypeTag(v) },
  ];

  return (
    <Modal
      title="变更明细"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col>
          <Input placeholder="字段名" allowClear style={{ width: 150 }}
            value={fieldNameFilter}
            onChange={e => setFieldNameFilter(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData(); }}
          />
        </Col>
        <Col>
          <Select placeholder="变更类型" allowClear style={{ width: 120 }}
            value={changeTypeFilter}
            onChange={v => { setChangeTypeFilter(v); setPage(1); }}
            options={[
              { value: 'update', label: '更新' },
              { value: 'insert', label: '新增' },
              { value: 'delete', label: '删除' },
            ]}
          />
        </Col>
        <Col>
          <Button type="primary" onClick={() => { setPage(1); fetchData(); }}>查询</Button>
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 800 }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200'],
          showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        size="small"
      />
    </Modal>
  );
}

// ─── Writeback Logs Tab ───
function WritebackLogTab({ dsOptions }: { dsOptions: { value: number; label: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WritebackLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const defaultFilters = { datasource_id: undefined, table_name: '', operator_user: '', timeRange: null, writeback_status: undefined };
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

  // Field change detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedWbLogId, setSelectedWbLogId] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (filters.datasource_id) params.datasource_id = filters.datasource_id;
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.operator_user) params.operator_user = filters.operator_user;
      if (filters.writeback_status) params.writeback_status = filters.writeback_status;
      if (filters.timeRange) {
        params.start_time = filters.timeRange[0].format('YYYY-MM-DDTHH:mm:ss');
        params.end_time = filters.timeRange[1].format('YYYY-MM-DDTHH:mm:ss');
      }
      const res = await listWritebackLogs(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch { message.error('加载回写日志失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: ColumnsType<WritebackLogItem> = [
    { title: '批次号', dataIndex: 'writeback_batch_no', width: 200 },
    { title: '数据源', dataIndex: 'datasource_name', width: 150 },
    { title: '表名', dataIndex: 'table_name', width: 140, render: (v, r) => r.table_alias ? `${r.table_alias}（${v}）` : v },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '更新', dataIndex: 'updated_row_count', width: 70 },
    { title: '新增', dataIndex: 'inserted_row_count', width: 70 },
    { title: '删除', dataIndex: 'deleted_row_count', width: 70 },
    { title: '失败', dataIndex: 'failed_row_count', width: 70 },
    { title: '备份版本号', dataIndex: 'backup_version_no', width: 200 },
    { title: '操作时间', dataIndex: 'started_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    { title: '状态', dataIndex: 'writeback_status', width: 100, render: v => statusTag(v) },
    {
      title: '操作', width: 100, fixed: 'right',
      render: (_: unknown, record: WritebackLogItem) => (
        <Button type="link" size="small" onClick={() => { setSelectedWbLogId(record.id); setDetailModalOpen(true); }}>
          变更明细
        </Button>
      ),
    },
  ];

  return (
    <>
      <FilterBar dsOptions={dsOptions} filters={filters} setFilters={setFilters}
        onSearch={() => { setPage(1); fetchData(); }}
        onReset={() => { setFilters(defaultFilters); setPage(1); }}
        extraFields={
          <Col>
            <Select placeholder="状态" allowClear style={{ width: 130 }}
              options={['success','failed','partial','running'].map(v => ({ value: v, label: v }))}
              value={filters.writeback_status}
              onChange={v => setFilters({ ...filters, writeback_status: v })}
            />
          </Col>
        }
      />
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        scroll={{ x: 1600 }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20','50','100'], showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
      <FieldChangeModal
        writebackLogId={selectedWbLogId}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
      />
    </>
  );
}

// ─── Export Tasks Tab (v2.3) ───
function ExportTaskTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExportTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listExportTasks({ page, page_size: pageSize });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch { message.error('加载导出任务失败'); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto refresh every 5s if there are processing tasks
  useEffect(() => {
    if (data.some(d => d.status === 'processing')) {
      const timer = setInterval(fetchData, 5000);
      return () => clearInterval(timer);
    }
  }, [data, fetchData]);

  const handleDownload = async (taskId: string, fileName?: string) => {
    try {
      const res = await downloadExportTask(taskId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'export.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    }
  };

  const columns: ColumnsType<ExportTaskItem> = [
    { title: '任务ID', dataIndex: 'task_id', width: 160 },
    { title: '表名', dataIndex: 'table_alias', width: 150, render: (v, r) => v || r.table_name || '-' },
    { title: '导出类型', dataIndex: 'export_type', width: 100 },
    { title: '行数', dataIndex: 'row_count', width: 80, render: v => v ?? '-' },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          processing: { color: 'blue', text: '处理中' },
          completed: { color: 'green', text: '已完成' },
          failed: { color: 'red', text: '失败' },
        };
        const info = map[v] || { color: 'default', text: v };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    { title: '完成时间', dataIndex: 'finished_at', width: 180, render: (v: string) => v ? formatBeijingTime(v) : '-' },
    {
      title: '操作', width: 100, fixed: 'right',
      render: (_: unknown, record: ExportTaskItem) => {
        if (record.status === 'completed') {
          return (
            <Button type="link" size="small" onClick={() => handleDownload(record.task_id, record.file_name || undefined)}>
              下载
            </Button>
          );
        }
        if (record.status === 'failed') {
          return <Tag color="red" style={{ fontSize: 11 }}>{record.error_message?.slice(0, 30) || '失败'}</Tag>;
        }
        return <Tag color="blue">处理中...</Tag>;
      },
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Button onClick={() => fetchData()}>刷新</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20','50','100'], showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </>
  );
}

// ─── Main Component ───
export default function LogCenter() {
  const { t } = useTranslation();
  const [dsOptions, setDsOptions] = useState<{ value: number; label: string }[]>([]);
  const logNav = useLogNavigate();

  useEffect(() => {
    listDatasources().then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setDsOptions(list.map((d: any) => ({ value: d.id, label: d.datasource_name })));
    });
  }, []);

  const handleRetryNavigate = (taskId: number) => {
    logNav(`/data-maintenance/diff/${taskId}`);
  };

  const items = [
    { key: 'system', label: '系统操作日志', children: <SystemLogTab dsOptions={dsOptions} /> },
    { key: 'export', label: '模板导出日志', children: <ExportLogTab dsOptions={dsOptions} /> },
    { key: 'export-tasks', label: '异步导出任务', children: <ExportTaskTab /> },
    { key: 'import', label: '模板导入日志', children: <ImportLogTab dsOptions={dsOptions} onRetryNavigate={handleRetryNavigate} /> },
    { key: 'writeback', label: '回写日志', children: <WritebackLogTab dsOptions={dsOptions} /> },
  ];

  return (
    <Card title={t('logCenter.title')}>
      <Tabs items={items} />
    </Card>
  );
}
