import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, Input, Form, Tabs, Alert, message, Button, Spin } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined, GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/request';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, authReady, login } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<{ captcha_id: string; image: string } | null>(null);
  const [form] = Form.useForm();
  const [networkOnline, setNetworkOnline] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('offline');
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrLoadedRef = useRef(false);

  useEffect(() => {
    if (authReady && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [authReady, isAuthenticated, navigate]);

  // Network check via backend (avoids CORS issues)
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const res = await api.get('/auth/network-check', { timeout: 8000 });
        const online = res.data?.online === true;
        setNetworkOnline(online);
        setActiveTab(online ? 'online' : 'offline');
      } catch {
        setNetworkOnline(false);
        setActiveTab('offline');
      } finally {
        setNetworkChecked(true);
      }
    };
    checkNetwork();
  }, []);

  const loadCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      setCaptcha(res.data);
      form.setFieldValue('captcha_code', '');
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  // Load WeChat QR code via JS SDK
  const loadWechatQR = useCallback(() => {
    if (!qrContainerRef.current || qrLoadedRef.current) return;

    const container = qrContainerRef.current;
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="ant-spin ant-spin-lg ant-spin-spinning"><span class="ant-spin-dot ant-spin-dot-spin"></span></div><div style="margin-top:12px;color:#999;">正在加载微信二维码...</div></div>';

    // Get QR params from backend (creates state in auth platform)
    api.get('/auth/wechat/qr-params').then(({ data }) => {
      // Load WeChat JS SDK
      const existingScript = document.querySelector('script[src*="wxLogin.js"]');
      const initQR = () => {
        if ((window as any).WxLogin) {
          container.innerHTML = '';
          new (window as any).WxLogin({
            self_redirect: false,
            id: 'wechat-qr-container',
            appid: data.appid,
            scope: data.scope,
            redirect_uri: data.redirect_uri,
            state: data.state,
            style: 'black',
            href: 'data:text/css;base64,' + btoa('.impowerBox .qrcode {width: 200px;} .impowerBox .title {display: none;} .impowerBox .info {display: none;} .impowerBox .status {text-align: center;}'),
          });
          qrLoadedRef.current = true;
        }
      };

      if (existingScript && (window as any).WxLogin) {
        initQR();
      } else {
        const script = document.createElement('script');
        script.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';
        script.onload = initQR;
        document.head.appendChild(script);
      }
    }).catch(() => {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">微信登录服务暂时不可用</div>';
    });
  }, []);

  // Load QR when switching to online tab
  useEffect(() => {
    if (activeTab === 'online' && networkOnline) {
      qrLoadedRef.current = false;
      setTimeout(loadWechatQR, 100);
    }
  }, [activeTab, networkOnline, loadWechatQR]);

  const handleLocalLogin = async (values: { username: string; password: string; captcha_code: string }) => {
    if (!captcha) return;
    setLoginLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', {
        username: values.username,
        password: values.password,
        captcha_id: captcha.captcha_id,
        captcha_code: values.captcha_code,
      });
      const { token, username, role, display_name } = res.data;
      login(token, {
        username,
        role,
        display_name,
        auth_source: '本地账号',
      });
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || '登录失败，请检查账号密码');
      loadCaptcha();
    } finally {
      setLoginLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'offline',
      label: '离线登录',
      children: (
        <Form form={form} onFinish={handleLocalLogin} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="dalimaoya" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="captcha_code" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                <Input prefix={<SafetyCertificateOutlined />} placeholder="验证码" />
              </Form.Item>
              {captcha && (
                <img
                  src={`data:image/png;base64,${captcha.image}`}
                  alt="captcha"
                  onClick={loadCaptcha}
                  style={{ height: 40, cursor: 'pointer', borderRadius: 6, border: '1px solid #d9d9d9', flexShrink: 0 }}
                  title="点击刷新验证码"
                />
              )}
            </div>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loginLoading} block style={{ height: 46, borderRadius: 10 }}>
              登录
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'online',
      label: '联网登录',
      disabled: !networkOnline,
      children: (
        <div style={{ textAlign: 'center', padding: '8px 0', height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {!networkOnline ? (
            <div style={{ color: '#999' }}>
              <GlobalOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
              当前网络不可用，请使用离线登录
            </div>
          ) : (
            <>
              <div
                id="wechat-qr-container"
                ref={qrContainerRef}
                style={{ width: '100%', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
              >
                <Spin size="large" tip="正在加载微信二维码..." />
              </div>
              <div style={{ marginTop: 4, color: '#999', fontSize: 13 }}>
                请使用微信扫描二维码登录
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo.png" alt="DataOps Workbench" style={{ height: 96 }} />
        </div>

        {!networkChecked && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <Spin size="small" /> <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>正在检测网络环境...</span>
          </div>
        )}

        {networkChecked && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{
              fontSize: 12,
              padding: '2px 10px',
              borderRadius: 10,
              background: networkOnline ? '#f6ffed' : '#fff7e6',
              color: networkOnline ? '#52c41a' : '#fa8c16',
              border: `1px solid ${networkOnline ? '#b7eb8f' : '#ffd591'}`,
            }}>
              {networkOnline ? '外网可用 · 支持联网登录' : '内网环境 · 仅支持离线登录'}
            </span>
          </div>
        )}

        {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} closable onClose={() => setError(null)} />}

        <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} centered />
      </Card>

      {/* Footer Links */}
      <div style={{ marginTop: 24, display: 'flex', gap: 24, alignItems: 'center' }}>
        <a
          href="https://github.com/dalimaoya/data-ops-workbench"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <GithubOutlined style={{ fontSize: 16 }} /> GitHub
        </a>
        <a
          href="https://gitee.com/dalimaoya/data-ops-workbench"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor">
            <path d="M512 1024C229.222 1024 0 794.778 0 512S229.222 0 512 0s512 229.222 512 512-229.222 512-512 512z m259.149-568.883h-290.74a25.293 25.293 0 0 0-25.292 25.293l-0.026 63.206c0 13.952 11.315 25.293 25.267 25.293h177.024c13.978 0 25.293 11.315 25.293 25.267v12.646a75.853 75.853 0 0 1-75.853 75.853h-240.23a25.293 25.293 0 0 1-25.267-25.293V417.203a75.853 75.853 0 0 1 75.827-75.853h353.946a25.293 25.293 0 0 0 25.267-25.292l0.077-63.207a25.293 25.293 0 0 0-25.268-25.293H417.152a189.62 189.62 0 0 0-189.62 189.645V771.15c0 13.977 11.316 25.293 25.294 25.293h372.94a170.65 170.65 0 0 0 170.65-170.65V480.384a25.293 25.293 0 0 0-25.293-25.267z" />
          </svg>
          Gitee
        </a>
      </div>
    </div>
  );
}
