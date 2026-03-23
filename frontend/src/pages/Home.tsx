import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, List, Tag, Button, Space, Typography, Empty } from 'antd';
import {
  DatabaseOutlined, TableOutlined, ExportOutlined, ImportOutlined,
  EditOutlined, WarningOutlined, PlusOutlined, SettingOutlined,
  ToolOutlined, FileTextOutlined, HistoryOutlined, RightOutlined,
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  getDashboardStats, getRecentOperations, getAlerts,
  getDashboardTrends, getDatasourceHealth, getTopTables,
} from '../api/dashboard';
import type {
  DashboardStats, RecentOperation, Alert,
  TrendDay, DatasourceHealth, TopTable,
} from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;

/* ── Mini trend chart (pure SVG, no extra lib) ── */
function TrendChart({ data }: { data: TrendDay[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padL = 36, padR = 16, padT = 16, padB = 32;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // find max
    let maxVal = 0;
    for (const d of data) {
      maxVal = Math.max(maxVal, d.export, d.import, d.writeback);
    }
    if (maxVal === 0) maxVal = 5;
    maxVal = Math.ceil(maxVal * 1.15);

    const xStep = plotW / Math.max(data.length - 1, 1);
    const toX = (i: number) => padL + i * xStep;
    const toY = (v: number) => padT + plotH - (v / maxVal) * plotH;

    // grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // Y axis labels
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      const val = Math.round(maxVal * (1 - i / 4));
      ctx.fillText(String(val), padL - 6, y + 4);
    }

    // X axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i++) {
      ctx.fillText(data[i].date, toX(i), h - 8);
    }

    // Draw lines
    const drawLine = (key: 'export' | 'import' | 'writeback', color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = toX(i);
        const y = toY(data[i][key]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // dots
      ctx.fillStyle = color;
      for (let i = 0; i < data.length; i++) {
        ctx.beginPath();
        ctx.arc(toX(i), toY(data[i][key]), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawLine('export', '#1890ff');
    drawLine('import', '#52c41a');
    drawLine('writeback', '#faad14');

  }, [data]);

  if (data.length === 0) {
    return <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 220, display: 'block' }}
      />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
        <Space><span style={{ display: 'inline-block', width: 12, height: 3, background: '#1890ff', borderRadius: 2 }} /> <Text type="secondary" style={{ fontSize: 12 }}>导出</Text></Space>
        <Space><span style={{ display: 'inline-block', width: 12, height: 3, background: '#52c41a', borderRadius: 2 }} /> <Text type="secondary" style={{ fontSize: 12 }}>导入</Text></Space>
        <Space><span style={{ display: 'inline-block', width: 12, height: 3, background: '#faad14', borderRadius: 2 }} /> <Text type="secondary" style={{ fontSize: 12 }}>回写</Text></Space>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operations, setOperations] = useState<RecentOperation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [dsHealth, setDsHealth] = useState<DatasourceHealth[]>([]);
  const [topTables, setTopTables] = useState<TopTable[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, o, a, t, h, tt] = await Promise.all([
          getDashboardStats(),
          getRecentOperations(),
          getAlerts(),
          getDashboardTrends(),
          getDatasourceHealth(),
          getTopTables(),
        ]);
        setStats(s.data);
        setOperations(o.data);
        setAlerts(a.data);
        setTrends(t.data);
        setDsHealth(h.data);
        setTopTables(tt.data);
      } catch {
        // If API fails, show empty state
      }
    };
    fetchAll();
  }, []);

  const statusColor = (s: string) =>
    s === 'success' ? 'green' : s === 'failed' ? 'red' : 'orange';

  const shortcuts = [
    { label: '新建数据源', icon: <PlusOutlined />, path: '/datasource/create' },
    { label: '配置表', icon: <SettingOutlined />, path: '/table-config' },
    { label: '数据维护', icon: <ToolOutlined />, path: '/data-maintenance' },
    { label: '查看日志', icon: <FileTextOutlined />, path: '/log-center' },
    { label: '版本回退', icon: <HistoryOutlined />, path: '/version-rollback' },
  ];

  const handleAlertAction = (alert: Alert) => {
    if (alert.type === 'structure_changed') {
      navigate(`/table-config/detail/${alert.target_id}`);
    } else if (alert.type === 'import_failed') {
      if (alert.table_config_id) {
        navigate(`/data-maintenance/browse/${alert.table_config_id}`);
      } else {
        navigate(`/data-maintenance`);
      }
    }
  };

  const healthIcon = (status: string) => {
    if (status === 'ok') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    return <QuestionCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />;
  };

  const healthLabel = (status: string) => {
    if (status === 'ok') return <Tag color="success">正常</Tag>;
    if (status === 'error') return <Tag color="error">异常</Tag>;
    return <Tag>未测试</Tag>;
  };

  const dbTypeLabel = (t: string) => {
    const map: Record<string, string> = { mysql: 'MySQL', postgresql: 'PostgreSQL', sqlserver: 'SQL Server', oracle: 'Oracle', dm: '达梦', kingbase: '金仓' };
    return map[t] || t;
  };

  return (
    <Card title="工作台总览" extra={
      <Text type="secondary" style={{ fontSize: 13 }}>
        欢迎回来，{user?.display_name || user?.username || '用户'}
        {user?.role && <Tag style={{ marginLeft: 8 }}>{
          user.role === 'admin' ? '管理员' : user.role === 'operator' ? '操作员' : '只读用户'
        }</Tag>}
      </Text>
    }>
      {/* 第一行：基础统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card hoverable onClick={() => navigate('/datasource')} size="small">
            <Statistic
              title="数据源"
              value={stats?.datasource_count ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable onClick={() => navigate('/table-config')} size="small">
            <Statistic
              title="已纳管表"
              value={stats?.table_count ?? 0}
              prefix={<TableOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="今日导出"
              value={stats?.today_export ?? 0}
              prefix={<ExportOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="今日导入"
              value={stats?.today_import ?? 0}
              prefix={<ImportOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="今日回写"
              value={stats?.today_writeback ?? 0}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 第二行：趋势图 */}
      <Card title="最近 7 天操作趋势" size="small" style={{ marginBottom: 16 }}>
        <TrendChart data={trends} />
      </Card>

      {/* 第三行：快捷入口 + 数据源健康 + 操作排行 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="快捷入口" size="small" style={{ height: '100%' }}>
            <Space wrap>
              {shortcuts.map((s) => (
                <Button
                  key={s.path}
                  icon={s.icon}
                  onClick={() => navigate(s.path)}
                >
                  {s.label}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={<Space><DatabaseOutlined /> 数据源状态</Space>}
            size="small"
            style={{ height: '100%' }}
          >
            {dsHealth.length > 0 ? (
              <List
                size="small"
                dataSource={dsHealth}
                renderItem={(item) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                      {healthIcon(item.status)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text ellipsis style={{ display: 'block', fontWeight: 500 }}>{item.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{dbTypeLabel(item.db_type)}</Text>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {healthLabel(item.status)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无数据源" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={<Space><TrophyOutlined /> 操作排行 Top 5（近 7 天）</Space>}
            size="small"
            style={{ height: '100%' }}
          >
            {topTables.length > 0 ? (
              <List
                size="small"
                dataSource={topTables}
                renderItem={(item, index) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                        background: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#f0f0f0',
                        color: index < 3 ? '#fff' : '#999',
                      }}>
                        {index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text ellipsis style={{ display: 'block', fontWeight: 500 }}>{item.table_name}</Text>
                        {item.datasource_name && (
                          <Text type="secondary" style={{ fontSize: 11 }}>{item.datasource_name}</Text>
                        )}
                      </div>
                      <Tag color="blue">{item.op_count} 次</Tag>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无操作记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 第四行：待处理提醒 */}
      {alerts.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              待处理提醒
              <Tag color="orange">{alerts.length}</Tag>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <List
            dataSource={alerts}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="action"
                    type="link"
                    size="small"
                    onClick={() => handleAlertAction(item)}
                    icon={<RightOutlined />}
                  >
                    去处理
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={item.level === 'error' ? 'red' : 'orange'}>
                        {item.title}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text>{item.message}</Text>
                      {item.created_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.created_at?.replace('T', ' ').slice(0, 19)}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 第五行（整行宽度）：最近操作 */}
      <Card
        title="最近操作"
        size="small"
        bodyStyle={{ padding: operations.length ? '0' : undefined }}
      >
        {operations.length > 0 ? (
          <List
            dataSource={operations}
            renderItem={(item) => (
              <List.Item style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                  <Tag color={statusColor(item.operation_status)} style={{ flexShrink: 0 }}>
                    {item.operation_status === 'success' ? '成功' : item.operation_status === 'failed' ? '失败' : item.operation_status}
                  </Tag>
                  <Text strong style={{ flexShrink: 0 }}>
                    {item.operation_type}
                  </Text>
                  <Text style={{ flex: 1 }}>
                    {item.readable_desc || item.operation_message || item.target_name || '-'}
                  </Text>
                  <Text type="secondary" style={{ flexShrink: 0, fontSize: 12 }}>
                    {item.operator_user}
                  </Text>
                  <Text type="secondary" style={{ flexShrink: 0, fontSize: 12 }}>
                    {item.created_at?.replace('T', ' ').slice(0, 19)}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无操作记录" />
        )}
      </Card>
    </Card>
  );
}
