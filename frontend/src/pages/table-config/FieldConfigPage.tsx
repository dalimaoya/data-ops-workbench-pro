import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Table, Switch, Input, InputNumber, Button, Space, message, Tag, Spin,
} from 'antd';
import {
  getTableConfig, listFields, updateField, batchUpdateFields, syncFields,
  type TableConfig as TC, type FieldConfig,
} from '../../api/tableConfig';

export default function FieldConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tcId = Number(id);

  const [tc, setTc] = useState<TC | null>(null);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<FieldConfig>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tcRes, fieldsRes] = await Promise.all([
        getTableConfig(tcId),
        listFields(tcId),
      ]);
      setTc(tcRes.data);
      setFields(fieldsRes.data);
    } finally {
      setLoading(false);
    }
  }, [tcId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (fieldId: number, key: string, value: boolean) => {
    try {
      await updateField(fieldId, { [key]: value ? 1 : 0 });
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, [key]: value ? 1 : 0 } : f));
    } catch (e: any) {
      message.error('更新失败');
    }
  };

  const handleInlineEdit = (f: FieldConfig) => {
    setEditingId(f.id);
    setEditingValues({
      field_alias: f.field_alias,
      max_length: f.max_length,
      enum_options_json: f.enum_options_json,
      remark: f.remark,
    });
  };

  const handleSaveInline = async () => {
    if (!editingId) return;
    try {
      await updateField(editingId, editingValues);
      message.success('已保存');
      setEditingId(null);
      fetchData();
    } catch (e: any) {
      message.error('保存失败');
    }
  };

  const handleBatchUpdate = async (updates: Partial<FieldConfig>) => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择字段'); return; }
    try {
      await batchUpdateFields(selectedRowKeys, updates);
      message.success('批量更新成功');
      setSelectedRowKeys([]);
      fetchData();
    } catch (e: any) {
      message.error('批量更新失败');
    }
  };

  const handleSyncFields = async () => {
    try {
      await syncFields(tcId);
      message.success('字段已重新同步');
      fetchData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '同步失败');
    }
  };

  const boolCol = (title: string, key: string) => ({
    title,
    dataIndex: key,
    width: 80,
    render: (v: number, r: FieldConfig) => (
      <Switch size="small" checked={v === 1} onChange={val => handleToggle(r.id, key, val)} />
    ),
  });

  const columns = [
    { title: '#', dataIndex: 'field_order_no', width: 50 },
    { title: '字段名', dataIndex: 'field_name', width: 140 },
    {
      title: '别名', dataIndex: 'field_alias', width: 140,
      render: (v: string, r: FieldConfig) => editingId === r.id ? (
        <Input size="small" value={editingValues.field_alias || ''} onChange={e => setEditingValues(p => ({ ...p, field_alias: e.target.value }))} />
      ) : v || '-',
    },
    { title: '类型', dataIndex: 'db_data_type', width: 110 },
    { title: '示例', dataIndex: 'sample_value', width: 120, ellipsis: true, render: (v: string) => v || '-' },
    boolCol('展示', 'is_displayed'),
    boolCol('可编辑', 'is_editable'),
    boolCol('必填', 'is_required'),
    {
      title: '主键', dataIndex: 'is_primary_key', width: 60,
      render: (v: number) => v ? <Tag color="blue">PK</Tag> : '-',
    },
    {
      title: '系统字段', dataIndex: 'is_system_field', width: 80,
      render: (v: number) => v ? <Tag color="orange">系统</Tag> : '-',
    },
    boolCol('导出', 'include_in_export'),
    boolCol('导入', 'include_in_import'),
    {
      title: '长度限制', dataIndex: 'max_length', width: 90,
      render: (v: number | null, r: FieldConfig) => editingId === r.id ? (
        <InputNumber size="small" value={editingValues.max_length} onChange={val => setEditingValues(p => ({ ...p, max_length: val ?? undefined }))} style={{ width: 70 }} />
      ) : (v || '-'),
    },
    {
      title: '枚举值', dataIndex: 'enum_options_json', width: 130, ellipsis: true,
      render: (v: string, r: FieldConfig) => editingId === r.id ? (
        <Input size="small" value={editingValues.enum_options_json || ''} onChange={e => setEditingValues(p => ({ ...p, enum_options_json: e.target.value }))} placeholder='["选项1","选项2"]' />
      ) : (v || '-'),
    },
    {
      title: '操作', width: 100, fixed: 'right' as const,
      render: (_: unknown, r: FieldConfig) => editingId === r.id ? (
        <Space size="small">
          <Button type="link" size="small" onClick={handleSaveInline}>保存</Button>
          <Button type="link" size="small" onClick={() => setEditingId(null)}>取消</Button>
        </Space>
      ) : (
        <Button type="link" size="small" onClick={() => handleInlineEdit(r)}>编辑</Button>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <div>
      <Card
        title={`字段配置 — ${tc?.table_alias || tc?.table_name || ''}`}
        extra={
          <Space>
            <Button size="small" onClick={handleSyncFields}>从数据库重新同步</Button>
            <Button size="small" onClick={() => navigate(`/table-config/detail/${tcId}`)}>返回表配置</Button>
            <Button size="small" onClick={() => navigate('/table-config')}>返回列表</Button>
          </Space>
        }
      >
        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
            <Space wrap>
              <span>已选 {selectedRowKeys.length} 项:</span>
              <Button size="small" onClick={() => handleBatchUpdate({ is_displayed: 1 } as any)}>全部展示</Button>
              <Button size="small" onClick={() => handleBatchUpdate({ is_displayed: 0 } as any)}>全部隐藏</Button>
              <Button size="small" onClick={() => handleBatchUpdate({ is_editable: 1 } as any)}>全部可编辑</Button>
              <Button size="small" onClick={() => handleBatchUpdate({ is_editable: 0 } as any)}>全部只读</Button>
              <Button size="small" onClick={() => handleBatchUpdate({ include_in_export: 1 } as any)}>全部参与导出</Button>
              <Button size="small" onClick={() => handleBatchUpdate({ include_in_import: 1 } as any)}>全部参与导入</Button>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
            </Space>
          </div>
        )}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={fields}
          size="small"
          pagination={false}
          scroll={{ x: 1600 }}
          rowSelection={{
            selectedRowKeys,
            onChange: keys => setSelectedRowKeys(keys as number[]),
          }}
        />
      </Card>
    </div>
  );
}
