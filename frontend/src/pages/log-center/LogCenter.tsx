import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tabs, Input, Select, DatePicker, Button, Tag, Row, Col, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  listSystemLogs, listExportLogs, listImportLogs, listWritebackLogs,
  type SystemLog, type ExportLog, type ImportLog, type WritebackLogItem,
} from '../../api/logs';
import { listDatasources } from '../../api/datasource';
import { formatBeijingTime } from '../../utils/formatTime';

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
function ImportLogTab({ dsOptions }: { dsOptions: { value: number; label: string }[] }) {
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

// ─── Writeback Logs Tab ───
function WritebackLogTab({ dsOptions }: { dsOptions: { value: number; label: string }[] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WritebackLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const defaultFilters = { datasource_id: undefined, table_name: '', operator_user: '', timeRange: null, writeback_status: undefined };
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

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
    { title: '文件名', dataIndex: 'file_name', width: 200, ellipsis: true },
    { title: '成功数', dataIndex: 'success_row_count', width: 80 },
    { title: '失败数', dataIndex: 'failed_row_count', width: 80 },
    { title: '备份版本号', dataIndex: 'backup_version_no', width: 200 },
    { title: '操作时间', dataIndex: 'started_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    { title: '状态', dataIndex: 'writeback_status', width: 100, render: v => statusTag(v) },
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
        scroll={{ x: 1500 }}
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
  const [dsOptions, setDsOptions] = useState<{ value: number; label: string }[]>([]);

  useEffect(() => {
    listDatasources().then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setDsOptions(list.map((d: any) => ({ value: d.id, label: d.datasource_name })));
    });
  }, []);

  const items = [
    { key: 'system', label: '系统操作日志', children: <SystemLogTab dsOptions={dsOptions} /> },
    { key: 'export', label: '模板导出日志', children: <ExportLogTab dsOptions={dsOptions} /> },
    { key: 'import', label: '模板导入日志', children: <ImportLogTab dsOptions={dsOptions} /> },
    { key: 'writeback', label: '回写日志', children: <WritebackLogTab dsOptions={dsOptions} /> },
  ];

  return (
    <Card title="日志中心">
      <Tabs items={items} />
    </Card>
  );
}
