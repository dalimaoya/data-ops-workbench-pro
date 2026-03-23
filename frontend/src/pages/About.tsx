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

      {/* User Manual */}
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
                <Title level={4}>{t('about.manualOverviewTitle')}</Title>
                <Paragraph>
                  {t('about.manualOverviewDesc')}
                </Paragraph>
                <Title level={5}>{t('about.roleDescription')}</Title>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{t('about.roleColumn')}</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{t('about.permissionColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.admin')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.adminPerm')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.operator')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.operatorPerm')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.readonly')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.readonlyPerm')}</td>
                    </tr>
                  </tbody>
                </table>
              </Typography>
            ) : (
              <Typography>
                <Title level={4}>{t('about.manualOverviewTitle')}</Title>
                <Paragraph>
                  {t('about.manualOverviewDesc')}
                </Paragraph>
                <Title level={5}>{t('about.roleDescription')}</Title>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{t('about.roleColumn')}</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{t('about.permissionColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.admin')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.adminPerm')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.operator')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.operatorPerm')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{t('role.readonly')}</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{t('about.readonlyPerm')}</td>
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
            children: (
              <Typography>
                <Title level={5}>{t('about.productPositioning')}</Title>
                <Paragraph>
                  {t('about.productPositioningDesc')}
                  <Text strong>{t('about.productPositioningHighlight')}</Text>
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
