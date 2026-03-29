import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin, Typography, Result, Button } from 'antd';
import { refreshPublicKey, verifyTokenOnline, verifyTokenOffline } from '../../api/unifiedAuth';
import { useAuth } from '../../context/AuthContext';

const { Title } = Typography;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUnifiedSession } = useAuth();
  const [status, setStatus] = useState('正在处理登录...');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = fragment.get('token') || fragment.get('access_token');

      // Clear hash from URL immediately
      window.history.replaceState({}, document.title, '/auth/callback');

      if (!token) {
        if (mounted) setFailed(true);
        return;
      }

      try {
        // Try to refresh public key (non-blocking)
        await refreshPublicKey().catch(() => {});

        // Verify token: online first, offline fallback
        let verified;
        try {
          verified = await verifyTokenOnline(token);
          verified.mode = 'online';
        } catch {
          verified = await verifyTokenOffline(token);
          verified.mode = 'offline';
        }

        if (!mounted) return;

        setStatus('登录成功，正在进入工作台...');

        setUnifiedSession({
          token,
          account_id: verified.account_id,
          expires_at: verified.expires_at,
          source: 'auth-platform',
          verify_mode: verified.mode === 'offline' ? 'offline' : 'online',
          offline_validated_at: verified.mode === 'offline' ? new Date().toISOString() : null,
        });

        // Small delay to let state propagate
        setTimeout(() => {
          if (mounted) navigate('/', { replace: true });
        }, 300);
      } catch {
        if (mounted) setFailed(true);
      }
    };

    run();
    return () => { mounted = false; };
  }, []);

  if (failed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f7fb' }}>
        <Card style={{ width: 480, borderRadius: 16 }}>
          <Result
            status="error"
            title="登录失败"
            subTitle="身份验证未通过，请重新登录"
            extra={<Button type="primary" href="/login">返回登录页</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f7fb' }}>
      <Card style={{ width: 480, borderRadius: 16 }}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 16 }}>{status}</Title>
        </div>
      </Card>
    </div>
  );
}
