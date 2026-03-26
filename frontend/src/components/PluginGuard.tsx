import { useEffect, useState, useCallback } from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface PluginGuardProps {
  pluginId: string;
  children: React.ReactNode;
}

/**
 * Wraps a plugin page — checks if the plugin is enabled before rendering.
 * If disabled, shows a friendly message with link to Plugin Center.
 */
export default function PluginGuard({ pluginId, children }: PluginGuardProps) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const checkEnabled = useCallback(() => {
    fetch('/api/plugins/loaded')
      .then(r => r.json())
      .then(data => {
        const plugins: { name: string; loaded: boolean }[] = data.plugins || [];
        const found = plugins.find(p => p.name === pluginId);
        setEnabled(found ? found.loaded : false);
      })
      .catch(() => setEnabled(false));
  }, [pluginId]);

  useEffect(() => {
    checkEnabled();
  }, [checkEnabled]);

  // Listen for plugin-status-changed events to update in real-time
  useEffect(() => {
    const handler = () => checkEnabled();
    window.addEventListener('plugin-status-changed', handler);
    return () => window.removeEventListener('plugin-status-changed', handler);
  }, [checkEnabled]);

  if (enabled === null) return null; // loading
  if (!enabled) {
    return (
      <Result
        icon={<StopOutlined style={{ color: '#ff4d4f' }} />}
        title={isZh ? '该插件未启用' : 'Plugin Not Enabled'}
        subTitle={isZh ? '请前往插件中心开启此功能' : 'Please enable this plugin in the Plugin Center'}
        extra={
          <Button type="primary" onClick={() => navigate('/plugin-center')}>
            {isZh ? '前往插件中心' : 'Go to Plugin Center'}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
