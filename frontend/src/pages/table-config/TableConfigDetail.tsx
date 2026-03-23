import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Descriptions, Form, Switch, InputNumber, Button, Space, message, Table, Tag, Spin, Typography,
} from 'antd';
import {
  getTableConfig, updateTableConfig, getSampleData, checkStructure, syncFields,
  type TableConfig as TC, type SampleDataResponse,
} from '../../api/tableConfig';

export default function TableConfigDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tc, setTc] = useState<TC | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState<SampleDataResponse | null>(null);
  const [form] = Form.useForm();

  const tcId = Number(id);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tcRes, sampleRes] = await Promise.all([
        getTableConfig(tcId),
        getSampleData(tcId, 5).catch(() => null),
      ]);
      setTc(tcRes.data);
      if (sampleRes) setSample(sampleRes.data);
      form.setFieldsValue({
        allow_export_current: tcRes.data.allow_export_current === 1,
        allow_export_all: tcRes.data.allow_export_all === 1,
        allow_import_writeback: tcRes.data.allow_import_writeback === 1,
        allow_insert_rows: tcRes.data.allow_insert_rows === 1,
        allow_delete_rows: tcRes.data.allow_delete_rows === 1,
        backup_keep_count: tcRes.data.backup_keep_count,
        strict_template_version: tcRes.data.strict_template_version === 1,
        strict_field_order: tcRes.data.strict_field_order === 1,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tcId]);

  const handleSave = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await updateTableConfig(tcId, {
        allow_export_current: v.allow_export_current ? 1 : 0,
        allow_export_all: v.allow_export_all ? 1 : 0,
        allow_import_writeback: v.allow_import_writeback ? 1 : 0,
        allow_insert_rows: v.allow_insert_rows ? 1 : 0,
        allow_delete_rows: v.allow_delete_rows ? 1 : 0,
        backup_keep_count: v.backup_keep_count,
        strict_template_version: v.strict_template_version ? 1 : 0,
        strict_field_order: v.strict_field_order ? 1 : 0,
      });
      message.success('保存成功');
      fetchData();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckStructure = async () => {
    const res = await checkStructure(tcId);
    if (res.data.status === 'normal') message.success(res.data.message);
    else if (res.data.status === 'changed') message.warning(res.data.message);
    else message.error(res.data.message);
    fetchData();
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

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!tc) return <div>纳管表不存在</div>;

  const structColor: Record<string, string> = { normal: 'green', changed: 'red', error: 'orange' };
  const structText: Record<string, string> = { normal: '正常', changed: '已变化', error: '检查失败' };

  const sampleColumns = sample?.columns.map(c => ({
    title: c, dataIndex: c, key: c, ellipsis: true, width: 140,
  })) || [];
  const sampleData = sample?.rows.map((row, idx) => {
    const obj: Record<string, unknown> = { _key: idx };
    sample.columns.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  }) || [];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>表配置管理</Typography.Title>
      <Card title="表基础信息" style={{ marginBottom: 16 }} extra={
        <Space>
          <Button size="small" onClick={handleCheckStructure}>检查表结构</Button>
          <Button size="small" onClick={handleSyncFields}>重新拉取字段</Button>
          <Button size="small" type="primary" onClick={() => navigate(`/table-config/fields/${tcId}`)}>配置字段</Button>
        </Space>
      }>
        <Descriptions column={3} bordered size="small">
          <Descriptions.Item label="数据源">{tc.datasource_name}</Descriptions.Item>
          <Descriptions.Item label="库/Schema">{tc.db_name || tc.schema_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="表名">{tc.table_name}</Descriptions.Item>
          <Descriptions.Item label="表别名">{tc.table_alias || '-'}</Descriptions.Item>
          <Descriptions.Item label="配置版本">v{tc.config_version}</Descriptions.Item>
          <Descriptions.Item label="字段数">{tc.field_count}</Descriptions.Item>
          <Descriptions.Item label="主键字段">{tc.primary_key_fields}</Descriptions.Item>
          <Descriptions.Item label="结构状态">
            <Tag color={structColor[tc.structure_check_status || ''] || 'default'}>
              {structText[tc.structure_check_status || ''] || '未检查'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="最近同步">{tc.last_sync_at || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="维护规则" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" style={{ flexWrap: 'wrap', gap: 16 }}>
          <Form.Item name="allow_export_current" label="允许导出当前" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allow_export_all" label="允许导出全量" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allow_import_writeback" label="允许上传回写" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allow_insert_rows" label="允许新增记录" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allow_delete_rows" label="允许删除记录" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="backup_keep_count" label="备份保留数">
            <InputNumber min={1} max={10} />
          </Form.Item>
          <Form.Item name="strict_template_version" label="强校验模板版本" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="strict_field_order" label="强校验字段顺序" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          <Space>
            <Button type="primary" loading={saving} onClick={handleSave}>保存配置</Button>
            <Button onClick={() => navigate('/table-config')}>返回列表</Button>
          </Space>
        </div>
      </Card>

      <Card title="样例数据预览">
        {sample && sample.rows.length > 0 ? (
          <Table
            rowKey="_key"
            columns={sampleColumns}
            dataSource={sampleData}
            size="small"
            pagination={false}
            scroll={{ x: sampleColumns.length * 140 }}
          />
        ) : (
          <div>暂无样例数据（可能数据源连接失败或表为空）</div>
        )}
      </Card>
    </div>
  );
}
