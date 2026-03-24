import { Card, Descriptions, Typography, Space, Tag, Divider, Collapse } from 'antd';
import { GithubOutlined, LinkOutlined, BookOutlined, InfoCircleOutlined, DatabaseOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Paragraph, Link, Text } = Typography;

const databases = [
  { name: 'MySQL', versions: '5.7+ / 8.0+', port: '3306' },
  { name: 'PostgreSQL', versions: '10+', port: '5432' },
  { name: 'SQL Server', versions: '2012+', port: '1433' },
  { name: 'Oracle', versions: '11g+', port: '1521' },
  { name: '达梦 (DM)', versions: 'DM8', port: '5236' },
  { name: '人大金仓 (KingbaseES)', versions: 'V8+', port: '54321' },
  { name: 'SQLite', versions: '3.x', port: '—' },
];

export default function About() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  return (
    <Card style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>{t('about.title')}</Title>
        <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>{t('about.version')}</Tag>
      </div>

      <Divider />

      {/* Feature Description */}
      <Title level={5}>{t('about.featureTitle')}</Title>
      <Paragraph>{t('about.featureDesc')}</Paragraph>

      <Divider />

      {/* Supported Databases */}
      <Title level={5}><DatabaseOutlined style={{ marginRight: 8 }} />{t('about.supportedDatabases')}</Title>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{isZh ? '数据库' : 'Database'}</th>
            <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{isZh ? '版本要求' : 'Version'}</th>
            <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>{isZh ? '默认端口' : 'Port'}</th>
          </tr>
        </thead>
        <tbody>
          {databases.map((db) => (
            <tr key={db.name}>
              <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>{db.name}</Text></td>
              <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{db.versions}</td>
              <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>{db.port}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
            children: (
              <Typography>
                <Title level={4}>{t('about.manualOverviewTitle')}</Title>
                <Paragraph>{t('about.manualOverviewDesc')}</Paragraph>
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

      {/* Documentation Links */}
      <Title level={5}><BookOutlined style={{ marginRight: 8 }} />{t('about.docsTitle')}</Title>
      <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
        <Paragraph style={{ margin: 0 }}>📖 {t('about.docUserManual')}</Paragraph>
        <Paragraph style={{ margin: 0 }}>📋 {t('about.docSystemInfo')}</Paragraph>
      </Space>

      <Divider />

      {/* Repository Links */}
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

      {/* Tech Stack */}
      <Title level={5}>{t('about.techStack')}</Title>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('about.frontend')}>React 19 + TypeScript + Ant Design 6 + Vite</Descriptions.Item>
        <Descriptions.Item label={t('about.backend')}>Python FastAPI + SQLAlchemy 2.0 + Pydantic 2</Descriptions.Item>
        <Descriptions.Item label={t('about.database')}>SQLite (platform) + 7 datasource types (MySQL / PG / SS / Oracle / DM / KingbaseES / SQLite)</Descriptions.Item>
        <Descriptions.Item label={t('about.templateEngine')}>openpyxl (Excel Import/Export)</Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* License */}
      <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 0 }}>
        <SafetyCertificateOutlined style={{ marginRight: 4 }} />
        {t('about.license')}: {t('about.licenseText')}
      </Paragraph>
    </Card>
  );
}
