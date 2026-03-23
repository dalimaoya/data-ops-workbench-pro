import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Select, Button, Input, Space, Table, message, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { listDatasources, type Datasource } from '../../api/datasource';
import { getRemoteTables, createTableConfig, type RemoteTableInfo } from '../../api/tableConfig';

export default function TableConfigCreate() {
  const navigate = useNavigate();
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [selectedDs, setSelectedDs] = useState<number | undefined>();
  const [remoteTables, setRemoteTables] = useState<RemoteTableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RemoteTableInfo | undefined>();
  const [tableSearch, setTableSearch] = useState('');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listDatasources({ page_size: 100 }).then(r => setDatasources(r.data));
  }, []);

  const handleDsChange = async (dsId: number) => {
    setSelectedDs(dsId);
    setSelectedTable(undefined);
    setRemoteTables([]);
    setLoadingTables(true);
    try {
      const res = await getRemoteTables(dsId);
      setRemoteTables(res.data.tables);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '获取表清单失败');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleSelectTable = (t: RemoteTableInfo) => {
    setSelectedTable(t);
    form.setFieldsValue({
      table_name: t.table_name,
      table_alias: t.table_name,
      table_comment: t.table_comment || '',
    });
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (!selectedDs) { message.error('请选择数据源'); return; }
    setSaving(true);
    try {
      const res = await createTableConfig({
        datasource_id: selectedDs,
        table_name: values.table_name,
        table_alias: values.table_alias,
        table_comment: values.table_comment,
        primary_key_fields: values.primary_key_fields,
        remark: values.remark,
      });
      message.success('纳管表创建成功');
      navigate(`/table-config/detail/${res.data.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const tableColumns = [
    { title: '表名', dataIndex: 'table_name' },
    { title: '备注', dataIndex: 'table_comment', render: (v: string) => v || '-' },
    {
      title: '操作',
      render: (_: unknown, r: RemoteTableInfo) => (
        <Button
          type={selectedTable?.table_name === r.table_name ? 'primary' : 'default'}
          size="small"
          onClick={() => handleSelectTable(r)}
        >
          {selectedTable?.table_name === r.table_name ? '已选择' : '选择'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card title="新增纳管表 - 第一步：选择数据源和表" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            placeholder="选择数据源" style={{ width: 400 }}
            options={datasources.map(d => ({ label: `${d.datasource_name} (${d.db_type})`, value: d.id }))}
            onChange={handleDsChange}
          />
          {selectedDs && (
            <Spin spinning={loadingTables}>
              <Input
                placeholder="搜索表名"
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 300, marginTop: 16, marginBottom: 8 }}
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
              />
              <Table
                rowKey="table_name"
                columns={tableColumns}
                dataSource={remoteTables.filter(t =>
                  !tableSearch || t.table_name.toLowerCase().includes(tableSearch.toLowerCase())
                  || (t.table_comment && t.table_comment.toLowerCase().includes(tableSearch.toLowerCase()))
                )}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </Spin>
          )}
        </Space>
      </Card>

      {selectedTable && (
        <Card title="第二步：配置基本信息">
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="table_name" label="表名" rules={[{ required: true }]}>
              <Input disabled />
            </Form.Item>
            <Form.Item name="table_alias" label="表别名">
              <Input placeholder="中文别名" />
            </Form.Item>
            <Form.Item name="table_comment" label="表说明">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="primary_key_fields" label="主键字段" rules={[{ required: true, message: '请输入主键字段' }]}
              tooltip="多个主键用英文逗号分隔">
              <Input placeholder="如: id 或 id,code" />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" loading={saving} onClick={handleSave}>
                  保存并自动拉取字段
                </Button>
                <Button onClick={() => navigate('/table-config')}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}
