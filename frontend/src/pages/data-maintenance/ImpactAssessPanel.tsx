import { useState } from 'react';
import { Button, Card, Tag, Table, Alert, Space, Descriptions, Divider } from 'antd';
import { RobotOutlined, SafetyCertificateOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { impactAssess } from '../../api/aiImpactAssess';
import { useTranslation } from 'react-i18next';
import { checkAIAvailable } from '../../utils/aiGuard';

interface Props {
  tableId: number;
  changes: Array<{
    row_pk?: string;
    field_name?: string;
    old_value?: string;
    new_value?: string;
    change_type?: string;
  }>;
}

const levelConfig: Record<string, { color: string; icon: string; label: string; bg: string }> = {
  high: { color: 'red', icon: '🔴', label: '高风险', bg: '#fff1f0' },
  medium: { color: 'orange', icon: '🟡', label: '中风险', bg: '#fff7e6' },
  low: { color: 'green', icon: '🟢', label: '低风险', bg: '#f6ffed' },
};

export default function ImpactAssessPanel({ tableId, changes }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const doAssess = async () => {
    if (!(await checkAIAvailable())) return;
    setLoading(true);
    try {
      const res = await impactAssess({ table_id: tableId, changes });
      setResult(res.data.data);
      setExpanded(true);
    } catch (e: any) {
      setResult({ error: e?.response?.data?.detail || t('common.failed') });
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <SafetyCertificateOutlined style={{ fontSize: 18, color: '#1890ff' }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{t('impact.title')}</span>
            <span style={{ color: '#999', fontSize: 12 }}>{t('impact.tipBeforeAssess', '回写前建议进行影响评估，识别潜在风险')}</span>
          </Space>
          <Button
            type="primary"
            ghost
            icon={<RobotOutlined />}
            loading={loading}
            onClick={doAssess}
          >
            {t('impact.assess')}
          </Button>
        </div>
      </Card>
    );
  }

  if (result?.error) {
    return (
      <Card
        size="small"
        style={{ marginTop: 16 }}
        title={<Space><SafetyCertificateOutlined /> {t('impact.title')}</Space>}
        extra={<Button size="small" onClick={() => setExpanded(false)}>{t('common.close')}</Button>}
      >
        <Alert type="error" message={result.error} showIcon />
      </Card>
    );
  }

  if (!result) return null;

  const { overall_level, risks, summary } = result;
  const cfg = levelConfig[overall_level] || levelConfig.low;

  const riskColumns = [
    {
      title: t('impact.riskLevel'),
      dataIndex: 'level',
      width: 110,
      render: (v: string) => {
        const c = levelConfig[v] || levelConfig.low;
        return <Tag color={c.color}>{c.icon} {c.label}</Tag>;
      },
    },
    {
      title: t('impact.riskType'),
      dataIndex: 'type',
      width: 140,
      render: (v: string) => <Tag>{t(`impact.type_${v}`, v)}</Tag>,
    },
    {
      title: t('impact.description'),
      dataIndex: 'message',
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: t('impact.suggestion'),
      dataIndex: 'suggestion',
      width: 280,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: '#666' }}>
          <ExclamationCircleOutlined style={{ marginRight: 4, color: '#faad14' }} />
          {v}
        </span>
      ),
    },
  ];

  const highCount = risks?.filter((r: any) => r.level === 'high').length ?? 0;
  const mediumCount = risks?.filter((r: any) => r.level === 'medium').length ?? 0;
  const lowCount = risks?.filter((r: any) => r.level === 'low').length ?? 0;

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
          <span>{t('impact.title')}</span>
          <Tag color={cfg.color} style={{ marginLeft: 4 }}>{cfg.icon} {cfg.label}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<RobotOutlined />} loading={loading} onClick={doAssess}>
            {t('impact.reassess', '重新评估')}
          </Button>
          <Button size="small" onClick={() => setExpanded(false)}>{t('common.close')}</Button>
        </Space>
      }
    >
      {/* 概览统计 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{
          flex: 1, padding: '12px 16px', borderRadius: 8,
          background: cfg.bg, border: `1px solid ${cfg.color === 'red' ? '#ffa39e' : cfg.color === 'orange' ? '#ffd591' : '#b7eb8f'}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: cfg.color === 'red' ? '#cf1322' : cfg.color === 'orange' ? '#d46b08' : '#389e0d' }}>
            {cfg.icon} {cfg.label}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t('impact.overallLevel', '综合风险等级')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{summary?.total_changes || 0}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t('impact.totalChanges')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{summary?.change_rows || 0}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t('impact.changeRows')}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{summary?.historical_writebacks || 0}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t('impact.historicalWritebacks')}</div>
        </div>
      </div>

      {/* 风险分布 */}
      {risks && risks.length > 0 && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Space size="middle">
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t('impact.riskDistribution', '风险分布')}:</span>
              {highCount > 0 && <Tag color="red">高风险 {highCount}</Tag>}
              {mediumCount > 0 && <Tag color="orange">中风险 {mediumCount}</Tag>}
              {lowCount > 0 && <Tag color="green">低风险 {lowCount}</Tag>}
            </Space>
          </div>
          <Table
            dataSource={risks}
            columns={riskColumns}
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={false}
            rowClassName={(record: any) => {
              if (record.level === 'high') return 'impact-row-high';
              if (record.level === 'medium') return 'impact-row-medium';
              return '';
            }}
          />
        </>
      )}

      {(!risks || risks.length === 0) && (
        <Alert type="success" message={t('impact.noRisk', '未发现风险项，可安全回写')} showIcon />
      )}

      <style>{`
        .impact-row-high td { background-color: #fff1f0 !important; }
        .impact-row-medium td { background-color: #fff7e6 !important; }
      `}</style>
    </Card>
  );
}
