import { useState, useEffect } from 'react';
import {
  Card, Switch, Radio, Select, Input, InputNumber, Slider, Button, Form,
  Space, Divider, Typography, message, Spin, Alert, Tag,
} from 'antd';
import {
  RobotOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, EyeOutlined, EyeInvisibleOutlined,
  SaveOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  getAIConfig, updateAIConfig, testAIConnection,
  type AIConfigData, type AIConfigUpdateData,
} from '../../api/aiConfig';

const { Title, Text } = Typography;

// ── Preset platforms ──
interface PlatformPreset {
  name: string;
  labelZh: string;
  labelEn: string;
  apiUrl: string;
  protocol: string;
  models: string[];
}

const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    name: 'deepseek', labelZh: 'DeepSeek', labelEn: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1', protocol: 'openai',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    name: 'qwen', labelZh: '通义千问 (Qwen)', labelEn: 'Qwen (Alibaba)',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  {
    name: 'siliconflow', labelZh: '硅基流动', labelEn: 'SiliconFlow',
    apiUrl: 'https://api.siliconflow.cn/v1', protocol: 'openai',
    models: ['deepseek-v3', 'qwen2.5-72b'],
  },
  {
    name: 'zhipu', labelZh: '智谱 GLM', labelEn: 'Zhipu GLM',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai',
    models: ['glm-4', 'glm-4-flash'],
  },
  {
    name: 'baidu', labelZh: '百度文心', labelEn: 'Baidu ERNIE',
    apiUrl: 'https://qianfan.baidubce.com/v2', protocol: 'openai',
    models: ['ernie-4.0-8k', 'ernie-3.5-8k'],
  },
  {
    name: 'kimi', labelZh: '月之暗面 Kimi', labelEn: 'Moonshot Kimi',
    apiUrl: 'https://api.moonshot.cn/v1', protocol: 'openai',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  {
    name: 'openai', labelZh: 'OpenAI', labelEn: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1', protocol: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    name: 'claude', labelZh: 'Anthropic Claude', labelEn: 'Anthropic Claude',
    apiUrl: 'https://api.anthropic.com', protocol: 'claude',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  {
    name: 'yi', labelZh: '零一万物 Yi', labelEn: 'Yi (01.AI)',
    apiUrl: 'https://api.lingyiwanwu.com/v1', protocol: 'openai',
    models: ['yi-large', 'yi-medium'],
  },
  {
    name: 'custom', labelZh: '自定义接口', labelEn: 'Custom',
    apiUrl: '', protocol: 'openai',
    models: [],
  },
];

const FEATURE_KEYS = [
  { key: 'field_suggest', zhLabel: '智能字段配置', enLabel: 'Smart Field Config' },
  { key: 'data_validate', zhLabel: '智能校验', enLabel: 'Smart Validation' },
  { key: 'nl_query', zhLabel: '自然语言查询', enLabel: 'Natural Language Query' },
  { key: 'log_analyze', zhLabel: '日志分析', enLabel: 'Log Analysis' },
  { key: 'batch_fill', zhLabel: '智能填充', enLabel: 'Smart Fill' },
  { key: 'health_check', zhLabel: '健康巡检', enLabel: 'Health Check' },
  { key: 'impact_assess', zhLabel: '影响评估', enLabel: 'Impact Assessment' },
];

export default function AIConfigPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [config, setConfig] = useState<AIConfigData | null>(null);
  const [form] = Form.useForm();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Track selected platform for model dropdown
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformPreset | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await getAIConfig();
      setConfig(res.data);
      // Populate form
      form.setFieldsValue({
        ai_enabled: res.data.ai_enabled,
        engine_mode: res.data.engine_mode,
        platform_name: res.data.platform_name || undefined,
        api_protocol: res.data.api_protocol,
        api_url: res.data.api_url,
        model_name: res.data.model_name || undefined,
        max_tokens: res.data.max_tokens,
        temperature: res.data.temperature,
      });
      // Set platform
      const preset = PLATFORM_PRESETS.find(p => p.name === res.data.platform_name);
      setSelectedPlatform(preset || null);
    } catch {
      message.error(t('common.failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handlePlatformChange = (platformName: string) => {
    const preset = PLATFORM_PRESETS.find(p => p.name === platformName);
    setSelectedPlatform(preset || null);
    if (preset) {
      form.setFieldsValue({
        platform_name: platformName,
        api_url: preset.apiUrl,
        api_protocol: preset.protocol,
        model_name: preset.models[0] || undefined,
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = form.getFieldsValue(true);
      const data: AIConfigUpdateData = {
        ai_enabled: values.ai_enabled,
        engine_mode: values.engine_mode,
        platform_name: values.platform_name,
        api_protocol: values.api_protocol,
        api_url: values.api_url,
        model_name: values.model_name,
        max_tokens: values.max_tokens,
        temperature: values.temperature,
        feature_flags: config?.feature_flags,
      };
      // Only send api_key if user typed something
      if (apiKeyInput) {
        data.api_key = apiKeyInput;
      }
      const res = await updateAIConfig(data);
      setConfig(res.data);
      setApiKeyInput('');
      message.success(t('common.success'));
    } catch (err: any) {
      message.error(err?.response?.data?.detail || t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const values = form.getFieldsValue(true);
      const res = await testAIConnection({
        api_protocol: values.api_protocol,
        api_url: values.api_url,
        api_key: apiKeyInput || undefined,
        model_name: values.model_name,
        max_tokens: values.max_tokens,
        temperature: values.temperature,
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.response?.data?.detail || t('common.failed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    fetchConfig();
    setApiKeyInput('');
    setTestResult(null);
  };

  const handleFeatureToggle = (key: string, checked: boolean) => {
    if (!config) return;
    const flags = { ...config.feature_flags, [key]: checked };
    setConfig({ ...config, feature_flags: flags });
  };

  const engineMode = Form.useWatch('engine_mode', form);
  const aiEnabled = Form.useWatch('ai_enabled', form);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>
        <RobotOutlined style={{ marginRight: 8 }} />
        {t('aiConfig.title')}
      </Title>

      <Form form={form} layout="vertical" initialValues={{ ai_enabled: true, engine_mode: 'builtin' }}>

        {/* ── AI Master Switch ── */}
        <Card style={{ marginBottom: 16 }}>
          <Form.Item name="ai_enabled" valuePropName="checked" label={t('aiConfig.masterSwitch')} style={{ marginBottom: 0 }}>
            <Switch checkedChildren={t('common.enable')} unCheckedChildren={t('common.disable')} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('aiConfig.masterSwitchHint')}</Text>
        </Card>

        {aiEnabled && (
          <>
            {/* ── Engine Mode ── */}
            <Card title={t('aiConfig.engineMode')} style={{ marginBottom: 16 }}>
              <Form.Item name="engine_mode" style={{ marginBottom: 0 }}>
                <Radio.Group>
                  <Radio.Button value="builtin">{t('aiConfig.modeBuiltin')}</Radio.Button>
                  <Radio.Button value="local">{t('aiConfig.modeLocal')}</Radio.Button>
                  <Radio.Button value="cloud">{t('aiConfig.modeCloud')}</Radio.Button>
                </Radio.Group>
              </Form.Item>
              {engineMode === 'builtin' && (
                <Alert
                  style={{ marginTop: 12 }}
                  type="info"
                  showIcon
                  message={t('aiConfig.builtinHint')}
                />
              )}
            </Card>

            {/* ── Local Model Config ── */}
            {engineMode === 'local' && (
              <Card title={t('aiConfig.localConfig')} style={{ marginBottom: 16 }}>
                {/* Local API URL */}
                <Form.Item name="api_url" label={t('aiConfig.localApiUrl')}>
                  <Input placeholder={t('aiConfig.localApiUrlPlaceholder')} />
                </Form.Item>

                {/* Model Name (manual input) */}
                <Form.Item name="model_name" label={t('aiConfig.localModelName')}>
                  <Input placeholder={t('aiConfig.localModelNamePlaceholder')} />
                </Form.Item>

                {/* Test Connection */}
                <Form.Item>
                  <Space>
                    <Button
                      icon={testing ? <LoadingOutlined /> : <ApiOutlined />}
                      onClick={handleTest}
                      loading={testing}
                    >
                      {t('aiConfig.localTestConnection')}
                    </Button>
                    {testResult && (
                      <Tag
                        icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        color={testResult.ok ? 'success' : 'error'}
                      >
                        {testResult.message}
                      </Tag>
                    )}
                  </Space>
                </Form.Item>
              </Card>
            )}

            {/* ── Cloud LLM Config ── */}
            {engineMode === 'cloud' && (
              <Card title={t('aiConfig.cloudConfig')} style={{ marginBottom: 16 }}>
                {/* Platform */}
                <Form.Item name="platform_name" label={t('aiConfig.platform')}>
                  <Select
                    placeholder={t('aiConfig.platformPlaceholder')}
                    onChange={handlePlatformChange}
                    options={PLATFORM_PRESETS.map(p => ({
                      value: p.name,
                      label: isZh ? p.labelZh : p.labelEn,
                    }))}
                  />
                </Form.Item>

                {/* API Protocol */}
                <Form.Item name="api_protocol" label={t('aiConfig.apiProtocol')}>
                  <Radio.Group>
                    <Radio value="openai">OpenAI {t('aiConfig.compatible')}</Radio>
                    <Radio value="claude">Claude {t('aiConfig.compatible')}</Radio>
                  </Radio.Group>
                </Form.Item>

                {/* API URL */}
                <Form.Item name="api_url" label={t('aiConfig.apiUrl')}>
                  <Input placeholder="https://api.example.com/v1" />
                </Form.Item>

                {/* API Key */}
                <Form.Item label={t('aiConfig.apiKey')}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      style={{ flex: 1 }}
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={config?.api_key_set
                        ? (config.api_key_masked || t('aiConfig.apiKeySet'))
                        : t('aiConfig.apiKeyPlaceholder')
                      }
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                    />
                    <Button
                      icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowApiKey(!showApiKey)}
                    />
                  </Space.Compact>
                  {config?.api_key_set && !apiKeyInput && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('aiConfig.apiKeyHint')}
                    </Text>
                  )}
                </Form.Item>

                {/* Model Name */}
                <Form.Item name="model_name" label={t('aiConfig.modelName')}>
                  <Select
                    showSearch
                    allowClear
                    placeholder={t('aiConfig.modelPlaceholder')}
                    options={
                      selectedPlatform?.models.length
                        ? selectedPlatform.models.map(m => ({ value: m, label: m }))
                        : []
                    }
                    // Allow free-text input
                    mode={undefined}
                    dropdownRender={menu => (
                      <>
                        {menu}
                        <Divider style={{ margin: '4px 0' }} />
                        <Text type="secondary" style={{ padding: '4px 12px', fontSize: 12 }}>
                          {t('aiConfig.modelManualHint')}
                        </Text>
                      </>
                    )}
                  />
                </Form.Item>

                {/* Max Tokens */}
                <Form.Item name="max_tokens" label={t('aiConfig.maxTokens')}>
                  <InputNumber min={256} max={128000} step={256} style={{ width: 200 }} />
                </Form.Item>

                {/* Temperature */}
                <Form.Item name="temperature" label={t('aiConfig.temperature')}>
                  <Slider min={0} max={1} step={0.05} marks={{ 0: '0', 0.3: '0.3', 0.7: '0.7', 1: '1' }} />
                </Form.Item>

                {/* Test Connection */}
                <Form.Item>
                  <Space>
                    <Button
                      icon={testing ? <LoadingOutlined /> : <ApiOutlined />}
                      onClick={handleTest}
                      loading={testing}
                    >
                      {t('aiConfig.testConnection')}
                    </Button>
                    {testResult && (
                      <Tag
                        icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        color={testResult.ok ? 'success' : 'error'}
                      >
                        {testResult.message}
                      </Tag>
                    )}
                  </Space>
                </Form.Item>
              </Card>
            )}

            {/* ── Feature Switches ── */}
            <Card title={t('aiConfig.featureSwitches')} style={{ marginBottom: 16 }}>
              {FEATURE_KEYS.map(f => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Text>{isZh ? f.zhLabel : f.enLabel}</Text>
                  <Switch
                    checked={config?.feature_flags?.[f.key] ?? true}
                    onChange={(checked) => handleFeatureToggle(f.key, checked)}
                  />
                </div>
              ))}
            </Card>
          </>
        )}

        {/* ── Action Buttons ── */}
        <Card>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              {t('aiConfig.saveConfig')}
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleReset}>
              {t('aiConfig.resetConfig')}
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
