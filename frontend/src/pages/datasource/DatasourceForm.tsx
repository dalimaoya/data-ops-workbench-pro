import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form, Input, InputNumber, Select, Button, Card, Space, message, Switch,
} from 'antd';
import {
  getDatasource, createDatasource, updateDatasource, testConnection,
} from '../../api/datasource';

const dbTypeOptions = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQL Server', value: 'sqlserver' },
  { label: 'Oracle', value: 'oracle' },
  { label: '达梦 (DM)', value: 'dm' },
  { label: '人大金仓 (KingbaseES)', value: 'kingbase' },
];

const defaultPorts: Record<string, number> = {
  mysql: 3306, postgresql: 5432, sqlserver: 1433,
  oracle: 1521, dm: 5236, kingbase: 54321,
};

export default function DatasourceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getDatasource(Number(id)).then(res => {
        const d = res.data;
        form.setFieldsValue({
          ...d,
          password: '', // Don't fill password
          status_switch: d.status === 'enabled',
        });
      });
    }
  }, [id]);

  const handleDbTypeChange = (val: string) => {
    form.setFieldValue('port', defaultPorts[val] || 3306);
  };

  const handleTest = async () => {
    try {
      const vals = await form.validateFields();
      setTesting(true);
      const res = await testConnection({
        db_type: vals.db_type,
        host: vals.host,
        port: vals.port,
        database_name: vals.database_name,
        schema_name: vals.schema_name,
        username: vals.username,
        password: vals.password,
        charset: vals.charset,
        connect_timeout_seconds: vals.connect_timeout_seconds,
      });
      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.message);
      }
    } catch {
      message.warning('请先完善表单必填项');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields();
      setLoading(true);
      const payload = {
        datasource_name: vals.datasource_name,
        db_type: vals.db_type,
        host: vals.host,
        port: vals.port,
        database_name: vals.database_name || undefined,
        schema_name: vals.schema_name || undefined,
        username: vals.username,
        password: vals.password,
        charset: vals.charset || 'utf8',
        connect_timeout_seconds: vals.connect_timeout_seconds || 10,
        status: vals.status_switch ? 'enabled' : 'disabled',
        remark: vals.remark || undefined,
      };
      if (isEdit) {
        await updateDatasource(Number(id), payload);
        message.success('更新成功');
      } else {
        await createDatasource(payload);
        message.success('创建成功');
      }
      navigate('/datasource');
    } catch {
      // validation error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={isEdit ? '编辑数据源' : '新建数据源'}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 600 }}
        initialValues={{ port: 3306, charset: 'utf8', connect_timeout_seconds: 10, status_switch: true }}
      >
        <Form.Item name="datasource_name" label="数据源名称" rules={[{ required: true, message: '请输入数据源名称' }]}>
          <Input placeholder="例：生产环境-MySQL" />
        </Form.Item>

        <Form.Item name="db_type" label="数据库类型" rules={[{ required: true, message: '请选择数据库类型' }]}>
          <Select options={dbTypeOptions} placeholder="请选择" onChange={handleDbTypeChange} />
        </Form.Item>

        <Space style={{ width: '100%' }}>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="127.0.0.1" />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true }]} style={{ width: 120 }}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        <Form.Item name="database_name" label="数据库名称">
          <Input placeholder="默认数据库名" />
        </Form.Item>

        <Form.Item name="schema_name" label="默认 Schema">
          <Input placeholder="如 dbo / public" />
        </Form.Item>

        <Space style={{ width: '100%' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: !isEdit, message: '请输入密码' }]} style={{ flex: 1 }}>
            <Input.Password placeholder={isEdit ? '留空则不修改' : ''} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }}>
          <Form.Item name="charset" label="编码">
            <Input style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="connect_timeout_seconds" label="超时(秒)">
            <InputNumber min={1} max={300} style={{ width: 120 }} />
          </Form.Item>
        </Space>

        <Form.Item name="status_switch" label="启用状态" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              {isEdit ? '保存修改' : '创建'}
            </Button>
            <Button loading={testing} onClick={handleTest}>测试连接</Button>
            <Button onClick={() => navigate('/datasource')}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
