import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, List, Tag, Button, Space, Typography, Empty } from 'antd';
import {
  DatabaseOutlined, TableOutlined, ExportOutlined, ImportOutlined,
  EditOutlined, WarningOutlined, PlusOutlined, SettingOutlined,
  ToolOutlined, FileTextOutlined, HistoryOutlined, RightOutlined,
} from '@ant-design/icons';
import { getDashboardStats, getRecentOperations, getAlerts } from '../api/dashboard';
import type { DashboardStats, RecentOperation, Alert } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operations, setOperations] = useState<RecentOperation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, o, a] = await Promise.all([
          getDashboardStats(),
          getRecentOperations(),
          getAlerts(),
        ]);
        setStats(s.data);
        setOperations(o.data);
        setAlerts(a.data);
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
      // Navigate to data maintenance browse page for the related table
      if (alert.table_config_id) {
        navigate(`/data-maintenance/browse/${alert.table_config_id}`);
      } else {
        navigate(`/data-maintenance`);
      }
    }
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

      {/* 第二行：快捷入口 */}
      <Card title="快捷入口" size="small" style={{ marginBottom: 16 }}>
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

      {/* 第三行：待处理提醒 */}
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

      {/* 第四行（整行宽度）：最近操作 */}
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
