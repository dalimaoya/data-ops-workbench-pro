import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, GithubOutlined, LinkOutlined } from '@ant-design/icons';
import { login as loginApi, getCaptcha } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await getCaptcha();
      setCaptchaId(res.data.captcha_id);
      setCaptchaImage(res.data.image);
    } catch {
      message.error('获取验证码失败');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const onFinish = async (values: { username: string; password: string; captcha_code: string }) => {
    setLoading(true);
    try {
      const res = await loginApi({
        username: values.username,
        password: values.password,
        captcha_id: captchaId,
        captcha_code: values.captcha_code,
      });
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
      // Refresh captcha on failure
      refreshCaptcha();
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
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="captcha_code"
                noStyle
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="验证码"
                  maxLength={4}
                  style={{ flex: 1 }}
                />
              </Form.Item>
              <img
                src={captchaImage ? `data:image/png;base64,${captchaImage}` : ''}
                alt="验证码"
                onClick={refreshCaptcha}
                style={{
                  height: 40,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: '1px solid #d9d9d9',
                  opacity: captchaLoading ? 0.5 : 1,
                  minWidth: 130,
                  objectFit: 'contain',
                  background: '#fafafa',
                }}
                title="点击刷新验证码"
              />
            </div>
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
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space size={16}>
            <a href="https://github.com/dalimaoya/data-ops-workbench" target="_blank" rel="noopener noreferrer"
               style={{ color: '#999', fontSize: 20 }} title="GitHub">
              <GithubOutlined />
            </a>
            <a href="https://gitee.com/dalimaoya/data-ops-workbench" target="_blank" rel="noopener noreferrer"
               style={{ color: '#999', fontSize: 20 }} title="Gitee">
              <LinkOutlined />
            </a>
          </Space>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, color: '#bbb', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} DataOps Workbench. All rights reserved.
        </div>
      </Card>
    </div>
  );
}
