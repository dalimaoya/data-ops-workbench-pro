import { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Tag, Space, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listMaintenanceTables, batchExportTables } from '../../api/dataMaintenance';
import type { MaintenanceTable } from '../../api/dataMaintenance';
import { listDatasources } from '../../api/datasource';
import type { Datasource } from '../../api/datasource';
import { formatBeijingTime } from '../../utils/formatTime';

export default function MaintenanceList() {
  const [data, setData] = useState<MaintenanceTable[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [datasourceId, setDatasourceId] = useState<number | undefined>(undefined);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchExporting, setBatchExporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listDatasources({ page_size: 100 }).then(r => setDatasources(r.data)).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listMaintenanceTables({
        keyword: keyword || undefined,
        datasource_id: datasourceId,
        page,
        page_size: pageSize,
      });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('获取表列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setKeyword('');
    setDatasourceId(undefined);
    setPage(1);
    // fetchData will be triggered by page change or we call it manually
    setTimeout(() => fetchData(), 0);
  };

  const handleBatchExport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要导出的表');
      return;
    }
    setBatchExporting(true);
    try {
      const res = await batchExportTables(selectedRowKeys);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers?.['content-disposition'];
      let filename = 'batch_export.zip';
      if (disposition) {
        const m = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
        if (m) filename = decodeURIComponent(m[1].replace(/"/g, ''));
      }
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success(`已导出 ${selectedRowKeys.length} 张表`);
      setSelectedRowKeys([]);
    } catch {
      message.error('批量导出失败');
    } finally {
      setBatchExporting(false);
    }
  };

  const columns = [
    {
      title: '表别名',
      dataIndex: 'table_alias',
      key: 'table_alias',
      render: (v: string, r: MaintenanceTable) => v || r.table_name,
    },
    { title: '数据源', dataIndex: 'datasource_name', key: 'datasource_name' },
    { title: '库/Schema', dataIndex: 'db_name', key: 'db_name', render: (v: string, r: MaintenanceTable) => v || r.schema_name || '-' },
    { title: '表名', dataIndex: 'table_name', key: 'table_name' },
    { title: '字段数', dataIndex: 'field_count', key: 'field_count', width: 80 },
    { title: '配置版本', dataIndex: 'config_version', key: 'config_version', width: 90, render: (v: number) => `v${v}` },
    {
      title: '结构状态',
      dataIndex: 'structure_check_status',
      key: 'structure_check_status',
      width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          normal: { color: 'green', text: '正常' },
          changed: { color: 'red', text: '已变化' },
          error: { color: 'orange', text: '检查失败' },
        };
        const s = map[v] || { color: 'default', text: v || '未知' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '更新人', dataIndex: 'updated_by', key: 'updated_by', width: 80 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180, render: (v: string) => formatBeijingTime(v) },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, r: MaintenanceTable) => (
        <Button type="link" onClick={() => navigate(`/data-maintenance/browse/${r.id}`)}>
          进入维护
        </Button>
      ),
    },
  ];

  return (
    <Card title="数据维护">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择数据源"
          allowClear
          value={datasourceId}
          onChange={(v) => setDatasourceId(v)}
          style={{ width: 200 }}
          options={datasources.map(ds => ({ label: ds.datasource_name, value: ds.id }))}
        />
        <Input
          placeholder="搜索表名/别名"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 260 }}
          allowClear
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
          查询
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置
        </Button>
        {selectedRowKeys.length > 0 && (
          <Button
            icon={<DownloadOutlined />}
            type="primary"
            loading={batchExporting}
            onClick={handleBatchExport}
          >
            批量导出 ({selectedRowKeys.length})
          </Button>
        )}
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showTotal: (t) => `共 ${t} 条`,
        }}
        scroll={{ x: 1000 }}
      />
    </Card>
  );
}
