import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Space, Tag, Input, Select, message, Popconfirm, Card, Typography,
} from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listDatasources, countDatasources, deleteDatasource,
  testExistingDatasource,
} from '../../api/datasource';
import type { Datasource } from '../../api/datasource';

const dbTypeOptions = [
  { label: '全部', value: '' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQL Server', value: 'sqlserver' },
];

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
];

export default function DatasourceList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Datasource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [dbType, setDbType] = useState('');
  const [status, setStatus] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (keyword) params.keyword = keyword;
      if (dbType) params.db_type = dbType;
      if (status) params.status = status;
      const [listRes, countRes] = await Promise.all([
        listDatasources(params),
        countDatasources(params),
      ]);
      setData(listRes.data);
      setTotal(countRes.data.total);
    } catch {
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchData(); };

  const handleDelete = async (id: number) => {
    await deleteDatasource(id);
    message.success('删除成功');
    fetchData();
  };

  const handleTest = async (id: number) => {
    const hide = message.loading('测试连接中...', 0);
    try {
      const res = await testExistingDatasource(id);
      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.message);
      }
      fetchData();
    } catch {
      message.error('测试连接请求失败');
    } finally {
      hide();
    }
  };

  const columns: ColumnsType<Datasource> = [
    { title: '数据源名称', dataIndex: 'datasource_name', width: 160 },
    {
      title: '数据库类型', dataIndex: 'db_type', width: 120,
      render: (v: string) => <Tag color={v === 'mysql' ? 'blue' : v === 'postgresql' ? 'green' : 'orange'}>{v.toUpperCase()}</Tag>,
    },
    { title: '主机地址', dataIndex: 'host', width: 160 },
    { title: '端口', dataIndex: 'port', width: 80 },
    { title: '库名', dataIndex: 'database_name', width: 120 },
    {
      title: '连接状态', dataIndex: 'last_test_status', width: 100,
      render: (v: string) => v ? <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag> : <Tag>未测试</Tag>,
    },
    {
      title: '启用状态', dataIndex: 'status', width: 90,
      render: (v: string) => <Tag color={v === 'enabled' ? 'green' : 'default'}>{v === 'enabled' ? '启用' : '禁用'}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', width: 150, ellipsis: true },
    {
      title: '操作', width: 240, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/datasource/edit/${record.id}`)}>编辑</Button>
          <Button size="small" onClick={() => handleTest(record.id)}>测试</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>数据源管理</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索数据源名称"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select options={dbTypeOptions} value={dbType} onChange={setDbType} style={{ width: 140 }} placeholder="数据库类型" />
          <Select options={statusOptions} value={status} onChange={setStatus} style={{ width: 120 }} placeholder="状态" />
          <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setDbType(''); setStatus(''); setPage(1); setTimeout(fetchData, 0); }}>重置</Button>
        </Space>
      </Card>

      <Card
        title="数据源列表"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/datasource/create')}>新建数据源</Button>}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
}
