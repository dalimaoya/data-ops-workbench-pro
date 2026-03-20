import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Input, Select, message, Popconfirm, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  listTableConfigs, countTableConfigs, deleteTableConfig, checkStructure,
  type TableConfig,
} from '../../api/tableConfig';
import { listDatasources, type Datasource } from '../../api/datasource';

export default function TableConfigList() {
  const navigate = useNavigate();
  const [data, setData] = useState<TableConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [filters, setFilters] = useState<{ datasource_id?: number; keyword?: string; status?: string }>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { ...filters, page, page_size: pageSize };
      const [listRes, countRes] = await Promise.all([
        listTableConfigs(params),
        countTableConfigs(params),
      ]);
      setData(listRes.data);
      setTotal(countRes.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listDatasources({ page_size: 100 }).then(r => setDatasources(r.data));
  }, []);

  useEffect(() => { fetchData(); }, [page, pageSize, filters]);

  const handleCheckStructure = async (id: number) => {
    const res = await checkStructure(id);
    if (res.data.status === 'normal') {
      message.success(res.data.message);
    } else if (res.data.status === 'changed') {
      message.warning(res.data.message);
    } else {
      message.error(res.data.message);
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await deleteTableConfig(id);
    message.success('已删除');
    fetchData();
  };

  const columns = [
    { title: '数据源', dataIndex: 'datasource_name', width: 140 },
    { title: '库/Schema', dataIndex: 'db_name', width: 120, render: (_: string, r: TableConfig) => r.db_name || r.schema_name || '-' },
    { title: '表名', dataIndex: 'table_name', width: 160 },
    { title: '表别名', dataIndex: 'table_alias', width: 130 },
    { title: '字段数', dataIndex: 'field_count', width: 80 },
    { title: '主键', dataIndex: 'primary_key_fields', width: 120 },
    { title: '版本', dataIndex: 'config_version', width: 70 },
    {
      title: '结构状态', dataIndex: 'structure_check_status', width: 100,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          normal: { color: 'green', text: '正常' },
          changed: { color: 'red', text: '已变化' },
          error: { color: 'orange', text: '检查失败' },
        };
        const info = map[v] || { color: 'default', text: v || '未检查' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v === 'enabled' ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', width: 280, fixed: 'right' as const,
      render: (_: unknown, r: TableConfig) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/table-config/detail/${r.id}`)}>配置</Button>
          <Button type="link" size="small" onClick={() => navigate(`/table-config/fields/${r.id}`)}>字段</Button>
          <Button type="link" size="small" onClick={() => handleCheckStructure(r.id)}>检查结构</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear placeholder="数据源" style={{ width: 200 }}
            options={datasources.map(d => ({ label: d.datasource_name, value: d.id }))}
            onChange={v => setFilters(f => ({ ...f, datasource_id: v }))}
          />
          <Select
            allowClear placeholder="状态" style={{ width: 120 }}
            options={[{ label: '启用', value: 'enabled' }, { label: '禁用', value: 'disabled' }]}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
          />
          <Input
            placeholder="搜索表名" prefix={<SearchOutlined />} style={{ width: 200 }}
            onPressEnter={e => setFilters(f => ({ ...f, keyword: (e.target as HTMLInputElement).value }))}
            allowClear onChange={e => { if (!e.target.value) setFilters(f => ({ ...f, keyword: undefined })); }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/table-config/create')}>
            新增纳管表
          </Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}
