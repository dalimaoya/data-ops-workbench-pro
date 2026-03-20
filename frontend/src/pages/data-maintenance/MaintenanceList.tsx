import { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Tag, Space, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listMaintenanceTables } from '../../api/dataMaintenance';
import type { MaintenanceTable } from '../../api/dataMaintenance';

export default function MaintenanceList() {
  const [data, setData] = useState<MaintenanceTable[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listMaintenanceTables({ keyword: keyword || undefined, page, page_size: pageSize });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('获取表列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

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
          error: { color: 'orange', text: '异常' },
        };
        const s = map[v] || { color: 'default', text: v || '未知' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '更新人', dataIndex: 'updated_by', key: 'updated_by', width: 80 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180 },
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
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索表名/别名"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onPressEnter={() => { setPage(1); fetchData(); }}
          style={{ width: 260 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); fetchData(); }}>
          查询
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
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
