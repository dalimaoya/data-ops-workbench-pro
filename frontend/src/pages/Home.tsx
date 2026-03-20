import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, List, Tag, Button, Space, Typography, Empty } from 'antd';
import {
  DatabaseOutlined, TableOutlined, ExportOutlined, ImportOutlined,
  EditOutlined, WarningOutlined, PlusOutlined, SettingOutlined,
  ToolOutlined, FileTextOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { getDashboardStats, getRecentOperations, getAlerts } from '../api/dashboard';
import type { DashboardStats, RecentOperation, Alert } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          工作台总览
        </Title>
        <Text type="secondary">
          欢迎回来，{user?.display_name || user?.username || '用户'}
          {user?.role && <Tag style={{ marginLeft: 8 }}>{
            user.role === 'admin' ? '管理员' : user.role === 'operator' ? '操作员' : '只读用户'
          }</Tag>}
        </Text>
      </div>

      {/* 基础统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card hoverable onClick={() => navigate('/datasource')}>
            <Statistic
              title="数据源"
              value={stats?.datasource_count ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable onClick={() => navigate('/table-config')}>
            <Statistic
              title="已纳管表"
              value={stats?.table_count ?? 0}
              prefix={<TableOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="今日导出"
              value={stats?.today_export ?? 0}
              prefix={<ExportOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="今日导入"
              value={stats?.today_import ?? 0}
              prefix={<ImportOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="今日回写"
              value={stats?.today_writeback ?? 0}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 最近操作 */}
        <Col span={12}>
          <Card
            title="最近操作"
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: operations.length ? '0' : undefined }}
          >
            {operations.length > 0 ? (
              <List
                dataSource={operations}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 16px' }}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>{item.operation_module}</Text>
                          <Text type="secondary">·</Text>
                          <Text>{item.operation_type}</Text>
                          <Tag color={statusColor(item.operation_status)}>
                            {item.operation_status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.target_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.operator_user} · {item.created_at?.replace('T', ' ').slice(0, 19)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无操作记录" />
            )}
          </Card>
        </Col>

        <Col span={12}>
          {/* 待处理提醒 */}
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                待处理提醒
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {alerts.length > 0 ? (
              <List
                dataSource={alerts}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={item.level === 'error' ? 'red' : 'orange'}>
                            {item.title}
                          </Tag>
                        </Space>
                      }
                      description={item.message}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无待处理提醒" />
            )}
          </Card>

          {/* 快捷入口 */}
          <Card title="快捷入口">
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
      </Row>
    </div>
  );
}
