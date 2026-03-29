import { useEffect, useState, useCallback } from 'react';
import { Result, Button, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { StopOutlined } from '@ant-design/icons';
import { api } from '../api/request';

interface PluginGuardProps {
  pluginId: string;
  children: React.ReactNode;
  requireLicense?: boolean;
}

interface PluginInfo {
  name: string;
  loaded: boolean;
  layer?: string;
  authorized?: boolean;
}

export default function PluginGuard({ pluginId, children, requireLicense = true }: PluginGuardProps) {
  const navigate = useNavigate();
  const [plugin, setPlugin] = useState<PluginInfo | null>(null);
  const [checked, setChecked] = useState(false);

  const checkPlugin = useCallback(async () => {
    try {
      const res = await api.get('/plugins/loaded');
      const plugins: PluginInfo[] = res.data.plugins || [];
      const found = plugins.find(p => p.name === pluginId);
      setPlugin(found || { name: pluginId, loaded: false, authorized: false });
    } catch {
      setPlugin({ name: pluginId, loaded: false, authorized: false });
    } finally {
      setChecked(true);
    }
  }, [pluginId]);

  useEffect(() => {
    checkPlugin();
  }, [checkPlugin]);

  useEffect(() => {
    const handler = () => checkPlugin();
    window.addEventListener('plugin-status-changed', handler);
    return () => window.removeEventListener('plugin-status-changed', handler);
  }, [checkPlugin]);

  if (!checked) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>;
  }

  if (!plugin?.loaded) {
    return (
      <Result
        icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
        title="该插件未启用"
        subTitle="请前往插件中心开启此功能"
        extra={<Button type="primary" onClick={() => navigate('/plugin-center')}>前往插件中心</Button>}
      />
    );
  }

  if (requireLicense && plugin.layer === 'extension' && !plugin.authorized) {
    return (
      <Result
        status="403"
        title="当前账号未开通此功能"
        subTitle={`插件标识：${pluginId}，请激活或联系管理员开通`}
        extra={<Button onClick={() => navigate('/about')}>前往激活</Button>}
      />
    );
  }

  return <>{children}</>;
}
