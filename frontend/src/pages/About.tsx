import { Card, Descriptions, Typography, Space, Tag, Divider, Collapse } from 'antd';
import { GithubOutlined, LinkOutlined, BookOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Paragraph, Link, Text } = Typography;

export default function About() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  return (
    <Card style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>{t('about.title')}</Title>
        <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>{t('about.version')}</Tag>
      </div>

      <Divider />

      <Title level={5}>{t('about.featureTitle')}</Title>
      <Paragraph>{t('about.featureDesc')}</Paragraph>

      <Divider />

      {/* User Manual - kept in Chinese as documentation */}
      <Collapse
        items={[
          {
            key: 'user-manual',
            label: (
              <Space>
                <BookOutlined />
                <Text strong>{t('about.userManual')}</Text>
              </Space>
            ),
            children: isZh ? (
              <Typography>
                <Title level={4}>一、系统概述</Title>
                <Paragraph>
                  数据运维工作台是一个轻量级的数据安全修订平台，帮助运维和业务人员在不直接接触数据库的前提下，通过标准化流程完成结果数据表的查看、修改、新增和删除，全程操作留痕、可追溯、可回退。
                </Paragraph>
                <Title level={5}>角色说明</Title>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>角色</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>权限范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>管理员</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>所有功能</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>操作员</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>数据维护（查看/编辑/导出/导入/回写/删除）、日志查看</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>只读用户</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>数据查看、模板导出、日志查看</td>
                    </tr>
                  </tbody>
                </table>
              </Typography>
            ) : (
              <Typography>
                <Title level={4}>1. System Overview</Title>
                <Paragraph>
                  Data Ops Workbench is a lightweight data revision platform that helps O&M and business staff view, modify, add and delete result data tables through standardized workflows without direct database access. All operations are traceable and reversible.
                </Paragraph>
                <Title level={5}>Role Description</Title>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>Role</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>Admin</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>All features</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>Operator</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>Data maintenance (view/edit/export/import/writeback/delete), log viewing</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>Readonly</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>Data viewing, template export, log viewing</td>
                    </tr>
                  </tbody>
                </table>
              </Typography>
            ),
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* System Info */}
      <Collapse
        items={[
          {
            key: 'system-info',
            label: (
              <Space>
                <InfoCircleOutlined />
                <Text strong>{t('about.systemInfo')}</Text>
              </Space>
            ),
            children: isZh ? (
              <Typography>
                <Title level={5}>产品定位</Title>
                <Paragraph>
                  数据运维工作台不是数据库开发工具，也不是传统数据填报平台。它聚焦于一件事：
                  <Text strong>让改数据这件事变得安全、可控、可追溯。</Text>
                </Paragraph>
              </Typography>
            ) : (
              <Typography>
                <Title level={5}>Product Positioning</Title>
                <Paragraph>
                  Data Ops Workbench is not a database development tool, nor a traditional data entry platform. It focuses on one thing:
                  <Text strong> Making data modification safe, controlled, and traceable.</Text>
                </Paragraph>
              </Typography>
            ),
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Divider />

      <Title level={5}>{t('about.projectRepo')}</Title>
      <Space direction="vertical" size={8} style={{ marginBottom: 16 }}>
        <Space>
          <GithubOutlined />
          <Link href="https://github.com/dalimaoya/data-ops-workbench" target="_blank">
            GitHub: dalimaoya/data-ops-workbench
          </Link>
        </Space>
        <Space>
          <LinkOutlined />
          <Link href="https://gitee.com/dalimaoya/data-ops-workbench" target="_blank">
            Gitee: dalimaoya/data-ops-workbench
          </Link>
        </Space>
      </Space>

      <Divider />

      <Title level={5}>{t('about.techStack')}</Title>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('about.frontend')}>React 18 + TypeScript + Ant Design 5 + Vite</Descriptions.Item>
        <Descriptions.Item label={t('about.backend')}>Python 3.11 + FastAPI + SQLAlchemy + Alembic</Descriptions.Item>
        <Descriptions.Item label={t('about.database')}>SQLite + Multi-datasource (MySQL / PostgreSQL / SQL Server etc.)</Descriptions.Item>
        <Descriptions.Item label={t('about.templateEngine')}>openpyxl (Excel Import/Export)</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
