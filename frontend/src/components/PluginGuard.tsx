import { useEffect, useState, useCallback } from 'react';
import { Result, Button, Spin, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { StopOutlined } from '@ant-design/icons';
import { checkPluginLicense } from '../api/unifiedAuth';
import { getLicenseCache, setLicenseCache } from '../services/unifiedAuth';

interface PluginGuardProps {
  pluginId: string;
  children: React.ReactNode;
  requireLicense?: boolean;
}

export default function PluginGuard({ pluginId, children, requireLicense = true }: PluginGuardProps) {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [license, setLicense] = useState<{ licensed: boolean; expires_at?: string | null } | null>(null);
  const [mode, setMode] = useState<'online' | 'offline-cache' | null>(null);

  const checkEnabled = useCallback(async () => {
    try {
      const response = await fetch('/api/plugins/loaded');
      const data = await response.json();
      const plugins: { name: string; loaded: boolean }[] = data.plugins || [];
      const found = plugins.find(p => p.name === pluginId);
      setEnabled(found ? found.loaded : false);
    } catch {
      setEnabled(false);
    }
  }, [pluginId]);

  const checkLicense = useCallback(async () => {
    if (!requireLicense) return;
    try {
      const data = await checkPluginLicense(pluginId);
      setLicense(data);
      setLicenseCache(pluginId, data);
      setMode('online');
    } catch {
      const cached = getLicenseCache()[pluginId];
      if (cached) {
        setLicense(cached);
        setMode('offline-cache');
      } else {
        setLicense({ licensed: false });
        setMode(null);
      }
    }
  }, [pluginId, requireLicense]);

  useEffect(() => {
    checkEnabled();
    checkLicense();
  }, [checkEnabled, checkLicense]);

  useEffect(() => {
    const handler = () => {
      checkEnabled();
      checkLicense();
    };
    window.addEventListener('plugin-status-changed', handler);
    return () => window.removeEventListener('plugin-status-changed', handler);
  }, [checkEnabled, checkLicense]);

  if (enabled === null || (requireLicense && !license)) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>;
  }

  if (!enabled) {
    return (
      <Result
        icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
        title="该插件未启用"
        subTitle="请前往插件中心开启此功能"
        extra={<Button type="primary" onClick={() => navigate('/plugin-center')}>前往插件中心</Button>}
      />
    );
  }

  if (requireLicense && !license?.licensed) {
    return (
      <Result
        status="403"
        title="当前账号未开通此功能"
        subTitle={`插件标识：${pluginId}${license?.expires_at ? `，授权到期：${license.expires_at}` : ''}`}
        extra={<Button onClick={() => navigate('/')}>返回首页</Button>}
      />
    );
  }

  return (
    <>
      {mode === 'offline-cache' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="当前处于离线授权缓存状态，部分在线能力可能受限" />
      )}
      {children}
    </>
  );
}
