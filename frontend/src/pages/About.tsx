import { Card, Descriptions, Typography, Space, Tag, Divider } from 'antd';
import { GithubOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Paragraph, Link } = Typography;

export default function About() {
  return (
    <Card style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>数据运维工作台</Title>
        <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>v1.0.0</Tag>
      </div>

      <Divider />

      <Title level={5}>功能简介</Title>
      <Paragraph>
        数据运维工作台是一个轻量级的数据安全修订平台，让运维和业务人员在不直接接触数据库客户端的前提下，
        通过"平台模板 + 校验预览 + 安全回写"的标准流程，完成结果数据表的日常维护。
        支持多数据源纳管、字段级配置、Excel 模板导入导出、差异比对预览、安全回写、版本备份与一键回退，
        全程操作留痕可追溯。
      </Paragraph>

      <Divider />

      <Title level={5}>项目仓库</Title>
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

      <Title level={5}>技术栈</Title>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="前端">React 18 + TypeScript + Ant Design 5 + Vite</Descriptions.Item>
        <Descriptions.Item label="后端">Python 3.11 + FastAPI + SQLAlchemy + Alembic</Descriptions.Item>
        <Descriptions.Item label="数据库">SQLite（系统元数据） + 多数据源连接（MySQL / PostgreSQL / SQL Server 等）</Descriptions.Item>
        <Descriptions.Item label="模板引擎">openpyxl（Excel 导入导出）</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
