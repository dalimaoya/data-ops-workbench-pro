import { Card, Descriptions, Typography, Space, Tag, Divider, Collapse } from 'antd';
import { GithubOutlined, LinkOutlined, BookOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Link, Text } = Typography;

export default function About() {
  return (
    <Card style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>数据运维工作台</Title>
        <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>v2.1.0</Tag>
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

      {/* 使用手册 */}
      <Collapse
        items={[
          {
            key: 'user-manual',
            label: (
              <Space>
                <BookOutlined />
                <Text strong>使用手册</Text>
              </Space>
            ),
            children: (
              <Typography>
                <Title level={5}>一、管理员配置流程</Title>
                <Paragraph>
                  管理员完成一次性配置后，普通用户即可自主进行数据维护操作。
                </Paragraph>
                <Paragraph>
                  <ol>
                    <li><Text strong>新建数据源</Text>：进入"数据源管理"，点击"新建"，填写数据库连接信息（类型、地址、端口、用户名、密码等）。</li>
                    <li><Text strong>测试连接</Text>：填写完成后点击"测试连接"，确认连接成功。</li>
                    <li><Text strong>新建纳管表</Text>：进入"纳管表配置"，点击"新建"，选择数据源，输入要管理的表名，系统将自动拉取表结构。</li>
                    <li><Text strong>字段配置</Text>：设置每个字段的别名、是否可编辑、是否必填、是否显示、校验规则等。</li>
                    <li><Text strong>完成</Text>：保存配置后，该表即可在"数据维护"模块中使用。</li>
                  </ol>
                </Paragraph>

                <Title level={5}>二、用户操作流程（导入回写）</Title>
                <Paragraph>
                  <ol>
                    <li><Text strong>选表</Text>：在"数据维护"列表中选择要维护的表，点击"进入维护"。</li>
                    <li><Text strong>浏览数据</Text>：查看当前表中的数据，支持分页浏览和搜索。</li>
                    <li><Text strong>导出模板</Text>：点击"导出"按钮，下载包含当前数据的 Excel 模板文件。</li>
                    <li><Text strong>本地修改</Text>：用 Excel 打开模板，修改需要变更的数据（不要修改隐藏的元信息行）。</li>
                    <li><Text strong>上传模板</Text>：回到平台，点击"导入"，上传修改后的 Excel 文件。</li>
                    <li><Text strong>校验</Text>：系统自动校验数据类型、必填项、枚举值等，校验不通过会提示错误详情。</li>
                    <li><Text strong>差异预览</Text>：校验通过后，系统会逐行逐字段展示原值与新值的差异。</li>
                    <li><Text strong>确认回写</Text>：确认差异无误后，点击"执行回写"，系统会先自动备份再写入数据库。</li>
                  </ol>
                </Paragraph>

                <Title level={5}>三、在线编辑</Title>
                <Paragraph>
                  <ol>
                    <li>在数据浏览页面，点击"编辑模式"按钮进入在线编辑。</li>
                    <li>直接在表格中点击单元格进行修改（仅可编辑字段允许修改）。</li>
                    <li>修改完成后，点击"保存"按钮，系统会自动备份并提交变更。</li>
                  </ol>
                </Paragraph>

                <Title level={5}>四、版本回退</Title>
                <Paragraph>
                  <ol>
                    <li>进入"版本回退"页面，查看所有备份版本列表。</li>
                    <li>找到需要回退到的版本，查看备份信息（时间、触发类型、记录数）。</li>
                    <li>点击"确认回退"，系统会用备份数据覆盖当前表数据。</li>
                  </ol>
                </Paragraph>

                <Title level={5}>五、常见问题</Title>
                <Paragraph>
                  <Text strong>Q: 模板上传失败怎么办？</Text>
                  <br />
                  A: 请确认上传的是平台导出的原始模板（不要删除隐藏的元信息行），且模板版本与当前纳管表配置版本一致。如果表配置发生变更，请重新导出模板。
                </Paragraph>
                <Paragraph>
                  <Text strong>Q: 提示"表结构已变化"怎么处理？</Text>
                  <br />
                  A: 说明数据库中的表结构与平台记录不一致。请联系管理员进入纳管表配置页面，点击"检查结构"，根据提示更新字段配置。更新完成后即可继续正常操作。
                </Paragraph>
                <Paragraph>
                  <Text strong>Q: 校验失败的数据怎么修正？</Text>
                  <br />
                  A: 校验结果会详细列出每一行的错误信息（行号、字段、错误类型、错误描述）。请根据错误提示在本地 Excel 中修正后重新上传。
                </Paragraph>
                <Paragraph>
                  <Text strong>Q: 回写后发现数据有误？</Text>
                  <br />
                  A: 每次回写前系统会自动全表备份。进入"版本回退"页面，找到回写前的备份版本，点击"确认回退"即可恢复。
                </Paragraph>
              </Typography>
            ),
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* 系统说明 */}
      <Collapse
        items={[
          {
            key: 'system-info',
            label: (
              <Space>
                <InfoCircleOutlined />
                <Text strong>系统说明</Text>
              </Space>
            ),
            children: (
              <Typography>
                <Title level={5}>产品定位</Title>
                <Paragraph>
                  数据运维工作台是一个<Text strong>轻量级的数据安全修订平台</Text>，让普通运维和业务人员在完全不接触数据库客户端的前提下，
                  通过"平台模板 + 校验预览 + 安全回写"的标准流程，完成结果数据表的日常维护。
                </Paragraph>
                <Paragraph>
                  它不是数据库开发工具，不是 BI 分析平台，也不是传统的数据填报系统——它只聚焦一件事：
                  <Text strong>让改数据这件事变得安全、可控、可追溯。</Text>
                </Paragraph>

                <Title level={5}>解决的痛点</Title>
                <Paragraph>
                  <ul>
                    <li><Text strong>直接改库风险高</Text>：用 Navicat、DBeaver 等客户端直接写 SQL 改数据，一条 UPDATE 写错就可能造成不可逆后果。</li>
                    <li><Text strong>线下 Excel 传递低效</Text>：导出数据 → 邮件/微信传 Excel → 人工复制粘贴回库，版本混乱、容易出错。</li>
                    <li><Text strong>口头通知改数无留痕</Text>：业务方口头通知研发改数据，改了什么、改了多少、谁改的，事后无从查证。</li>
                    <li><Text strong>临时脚本不可见</Text>：运维写临时脚本处理数据，过程不透明，出了问题难以追溯和回退。</li>
                    <li><Text strong>普通人员无法自主操作</Text>：每次改数据都要找研发，研发变成改数据的"人肉接口"。</li>
                  </ul>
                </Paragraph>

                <Title level={5}>目标用户</Title>
                <Paragraph>
                  <ul>
                    <li><Text strong>配置角色</Text>（研发工程师、实施工程师、系统管理员）：一次性配置数据源、纳管表、字段规则。</li>
                    <li><Text strong>使用角色</Text>（普通运维人员、业务数据维护人员）：日常查看数据、下载模板、本地修改、上传校验、确认回写。</li>
                    <li><Text strong>管理角色</Text>（项目负责人、高级管理员）：查看操作日志、在出问题时执行版本回退。</li>
                  </ul>
                </Paragraph>
                <Paragraph>
                  核心理念：<Text strong>研发配置一次，普通用户可以反复安全使用。</Text>
                </Paragraph>

                <Title level={5}>设计思路</Title>
                <Paragraph>
                  <ul>
                    <li><Text strong>安全第一</Text>：写前必校验、写前必预览、写前必备份、写后可回退。</li>
                    <li><Text strong>平台模板机制</Text>：所有数据修订必须通过平台导出的标准模板完成，杜绝任意来源的 Excel 直接导入。</li>
                    <li><Text strong>最小权限原则</Text>：三角色分权（管理员配置、操作员执行、只读用户查看），普通用户全程不接触数据库连接信息。</li>
                    <li><Text strong>一次配置、反复使用</Text>：将研发的一次性劳动转化为团队可重复执行的标准流程。</li>
                  </ul>
                </Paragraph>
              </Typography>
            ),
          },
        ]}
        style={{ marginBottom: 16 }}
      />

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
