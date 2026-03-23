import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await loginApi(values);
      const data = res.data;
      login(data.token, {
        username: data.username,
        role: data.role,
        display_name: data.display_name,
      });
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.detail || '登录失败，请检查用户名和密码';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="DataOps Workbench" style={{ height: 64, marginBottom: 12 }} />
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
            数据运维工作台
          </Title>
          <Text type="secondary">Data Ops Workbench</Text>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, borderRadius: 8 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
