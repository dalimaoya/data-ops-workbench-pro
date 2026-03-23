import { Card, Descriptions, Typography, Space, Tag, Divider, Collapse } from 'antd';
import { GithubOutlined, LinkOutlined, BookOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Link, Text } = Typography;

export default function About() {
  return (
    <Card style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>数据运维工作台</Title>
        <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>v2.5.0</Tag>
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
                {/* ── 一、系统概述 ── */}
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
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>所有功能：数据源管理、纳管表配置、字段配置、数据维护（查看/编辑/导出/导入/回写/删除）、版本回退、用户管理、日志查看</td>
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

                {/* ── 二、管理员配置流程 ── */}
                <Title level={4}>二、管理员配置流程（一次性）</Title>
                <Paragraph>完成以下配置后，普通用户即可独立使用系统进行日常数据维护。</Paragraph>

                <Title level={5}>2.1 新建数据源</Title>
                <Paragraph>
                  <ol>
                    <li>进入 <Text strong>数据源管理</Text> → 点击 <Text strong>新建数据源</Text></li>
                    <li>填写连接信息：
                      <ul>
                        <li>数据源名称（自定义，如"生产库-MySQL"）</li>
                        <li>数据库类型（MySQL / PostgreSQL / SQL Server / Oracle / 达梦 / 人大金仓）</li>
                        <li>主机地址、端口（选择数据库类型后自动填充默认端口）</li>
                        <li>用户名、密码</li>
                        <li>数据库名（必填）、Schema（PostgreSQL/SQL Server 可选）</li>
                      </ul>
                    </li>
                    <li>点击 <Text strong>测试连接</Text> 确认连通</li>
                    <li>点击 <Text strong>保存</Text></li>
                  </ol>
                </Paragraph>

                <Title level={5}>2.2 新建纳管表</Title>
                <Paragraph>
                  <ol>
                    <li>进入 <Text strong>表配置管理</Text> → 点击 <Text strong>新建纳管表</Text></li>
                    <li>第一步：选择数据源 → 系统自动拉取该数据源下的所有表</li>
                    <li>使用搜索框快速找到目标表，点击 <Text strong>选择</Text></li>
                    <li>第二步：填写基本信息
                      <ul>
                        <li>表别名（中文名称，方便用户识别）</li>
                        <li>主键字段（多个主键用英文逗号分隔，如 <Text code>id</Text> 或 <Text code>id,code</Text>）</li>
                      </ul>
                    </li>
                    <li>点击 <Text strong>保存并自动拉取字段</Text></li>
                  </ol>
                </Paragraph>

                <Title level={5}>2.3 字段配置</Title>
                <Paragraph>保存纳管表后自动进入字段配置页面：</Paragraph>
                <Paragraph>
                  <ul>
                    <li><Text strong>展示</Text>：控制该字段是否在数据浏览页面显示</li>
                    <li><Text strong>可编辑</Text>：控制该字段是否允许用户修改（主键和系统字段默认不可编辑）</li>
                    <li><Text strong>必填</Text>：控制导入时该字段是否必须有值</li>
                    <li><Text strong>参与导出</Text>：控制该字段是否出现在导出的模板中</li>
                    <li><Text strong>参与导入</Text>：控制该字段是否参与导入校验</li>
                    <li><Text strong>别名</Text>：字段的中文显示名</li>
                    <li><Text strong>枚举值</Text>：限制该字段只能填写指定值（用英文逗号分隔，如 <Text code>是,否</Text>）</li>
                    <li><Text strong>长度限制</Text>：限制该字段的最大字符长度</li>
                  </ul>
                </Paragraph>
                <Paragraph type="secondary">
                  提示：系统字段（如 created_at、updated_at 等）会自动标记，默认不参与导出和导入。
                </Paragraph>

                <Title level={5}>2.4 用户管理</Title>
                <Paragraph>
                  <ol>
                    <li>进入 <Text strong>用户管理</Text>（仅管理员可见）</li>
                    <li>可以新增用户、设置角色（管理员/操作员/只读）、禁用/启用账号、重置密码</li>
                  </ol>
                </Paragraph>

                {/* ── 三、日常操作流程 ── */}
                <Title level={4}>三、日常操作流程</Title>

                <Title level={5}>3.1 数据浏览</Title>
                <Paragraph>
                  <ol>
                    <li>进入 <Text strong>数据维护</Text> → 选择目标表 → 点击 <Text strong>进入维护</Text></li>
                    <li>数据以表格形式分页展示</li>
                    <li>支持全局关键字搜索和按字段筛选</li>
                    <li>如果表很多，可以使用数据源下拉筛选或表名搜索框快速定位</li>
                  </ol>
                </Paragraph>

                <Title level={5}>3.2 模板导出</Title>
                <Paragraph>
                  <ol>
                    <li>在数据浏览页点击 <Text strong>导出模板</Text></li>
                    <li>选择导出范围：全量数据 / 当前筛选结果</li>
                    <li>确认后自动下载 Excel 文件</li>
                    <li>模板中包含隐藏的元信息（_meta 工作表），请勿删除或修改</li>
                  </ol>
                </Paragraph>
                <Paragraph type="secondary">
                  注意：模板有工作表保护，表头行和主键列不可修改，仅可编辑字段的数据区域允许编辑。
                </Paragraph>

                <Title level={5}>3.3 模板修改与导入</Title>
                <Paragraph>
                  <ol>
                    <li>用 Excel 打开下载的模板</li>
                    <li>修改可编辑字段的数据（黄底/白底单元格）</li>
                    <li>如需新增数据，在模板底部空白行区域填写（包括主键）</li>
                    <li>保存后回到系统，点击 <Text strong>导入模板</Text> → 选择文件 → 点击 <Text strong>开始校验</Text></li>
                    <li>系统自动校验：
                      <ul>
                        <li>模板合法性（必须是平台导出的模板）</li>
                        <li>列数和列名是否一致</li>
                        <li>数据类型、必填项、枚举值、长度限制</li>
                        <li>主键是否被修改（已有行的主键不允许变更）</li>
                      </ul>
                    </li>
                    <li>校验通过后查看校验结果
                      <ul>
                        <li>如有错误：导出错误明细 → 修正 → 重新上传</li>
                        <li>如全部通过：点击 <Text strong>查看差异预览</Text></li>
                      </ul>
                    </li>
                  </ol>
                </Paragraph>

                <Title level={5}>3.4 差异预览与回写</Title>
                <Paragraph>
                  <ol>
                    <li>差异预览页面展示每行每字段的原值与新值对比</li>
                    <li>更新行显示蓝色，新增行显示绿色</li>
                    <li>确认无误后点击 <Text strong>确认写入</Text></li>
                    <li>系统自动执行：
                      <ul>
                        <li>全表备份（保留最近 3 个版本）</li>
                        <li>逐行执行 UPDATE / INSERT</li>
                        <li>记录回写日志和逐字段变更明细</li>
                      </ul>
                    </li>
                    <li>写入结果页显示成功/失败数量</li>
                  </ol>
                </Paragraph>

                <Title level={5}>3.5 在线编辑（快捷修改）</Title>
                <Paragraph>适用于只改少量数据、不想走模板流程的场景：</Paragraph>
                <Paragraph>
                  <ol>
                    <li>在数据浏览页点击 <Text strong>编辑模式</Text></li>
                    <li>可编辑字段变为输入框，主键和系统字段保持只读</li>
                    <li>直接修改需要更改的值，修改过的单元格会黄色高亮</li>
                    <li>点击 <Text strong>保存修改</Text> → 弹出差异预览确认</li>
                    <li>确认后自动备份 + 更新 + 记录日志</li>
                  </ol>
                </Paragraph>

                <Title level={5}>3.6 新增行</Title>
                <Paragraph>
                  <ol>
                    <li>在数据浏览页点击 <Text strong>新增行</Text></li>
                    <li>在弹出的表单中填写各字段值</li>
                    <li>点击保存，数据直接 INSERT 到数据库</li>
                  </ol>
                </Paragraph>

                <Title level={5}>3.7 删除行</Title>
                <Paragraph>
                  <ol>
                    <li>在数据浏览页勾选需要删除的行</li>
                    <li>点击 <Text strong>删除选中行</Text></li>
                    <li>弹窗确认待删除行数</li>
                    <li>确认后自动备份 + 删除 + 记录日志</li>
                  </ol>
                </Paragraph>

                {/* ── 四、版本回退 ── */}
                <Title level={4}>四、版本回退</Title>
                <Paragraph>当回写出错或需要恢复历史数据时：</Paragraph>
                <Paragraph>
                  <ol>
                    <li>进入 <Text strong>版本回退</Text>（仅管理员可操作）</li>
                    <li>使用筛选条件找到目标备份版本</li>
                    <li>点击查看版本详情，确认备份时间、数据量</li>
                    <li>点击 <Text strong>回退到此版本</Text></li>
                    <li>系统会先备份当前数据，再恢复到选定版本</li>
                    <li>回退操作会记录在日志中</li>
                  </ol>
                </Paragraph>

                {/* ── 五、日志中心 ── */}
                <Title level={4}>五、日志中心</Title>
                <Paragraph>日志中心分为四个页签：</Paragraph>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>页签</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>记录内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>系统操作日志</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>所有操作记录：数据源管理、表配置、导出、导入、回写、删除、回退、用户管理等</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>模板导出日志</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>每次导出的批次号、表名、行数、文件名、操作人、时间</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>模板导入日志</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>每次导入的批次号、表名、文件名、校验结果（通过/失败数）、操作人</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}><Text strong>回写日志</Text></td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>每次回写的批次号、表名、更新/新增/删除数量、备份版本号，点击可查看逐字段变更明细</td>
                    </tr>
                  </tbody>
                </table>

                {/* ── 六、常见问题 ── */}
                <Title level={4}>六、常见问题</Title>
                <Paragraph>
                  <Text strong>Q1：模板上传失败怎么办？</Text>
                  <br />
                  <Text strong>A：</Text>常见原因：
                  <ul>
                    <li>上传的不是平台导出的模板（缺少 _meta 工作表）→ 请从系统重新导出</li>
                    <li>列数或列名被修改 → 请勿修改表头行</li>
                    <li>模板版本与当前配置不一致 → 重新导出最新模板</li>
                  </ul>
                </Paragraph>
                <Paragraph>
                  <Text strong>Q2：提示"表结构已变化"怎么处理？</Text>
                  <br />
                  <Text strong>A：</Text>说明数据库中的表结构（字段增删改）与系统记录不一致。管理员需要：
                  <ol>
                    <li>进入表配置管理 → 点击该表的 <Text strong>检查结构</Text></li>
                    <li>确认变化后点击 <Text strong>同步字段</Text></li>
                    <li>重新配置新增字段的属性</li>
                  </ol>
                </Paragraph>
                <Paragraph>
                  <Text strong>Q3：回写失败了数据会丢失吗？</Text>
                  <br />
                  <Text strong>A：</Text>不会。系统在每次回写前都会自动全表备份。如果回写过程中出现错误，可以通过版本回退恢复到回写前的状态。
                </Paragraph>
                <Paragraph>
                  <Text strong>Q4：如何修改自己的密码？</Text>
                  <br />
                  <Text strong>A：</Text>点击页面右上角的用户名 → 选择"修改密码" → 输入旧密码和新密码。
                </Paragraph>
                <Paragraph>
                  <Text strong>Q5：导出的模板为什么有些字段不能编辑？</Text>
                  <br />
                  <Text strong>A：</Text>模板使用了 Excel 工作表保护：
                  <ul>
                    <li>表头行：锁定，防止误改列名</li>
                    <li>主键列：已有数据行的主键锁定，防止误改关联关系</li>
                    <li>系统字段：不参与导出</li>
                    <li>可编辑字段的数据区域：正常可编辑</li>
                  </ul>
                </Paragraph>
                <Paragraph>
                  <Text strong>Q6：支持哪些数据库？</Text>
                  <br />
                  <Text strong>A：</Text>目前支持 6 种数据库：MySQL、PostgreSQL、SQL Server、Oracle、达梦（DM）、人大金仓（KingbaseES）。
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
                  数据运维工作台不是数据库开发工具，也不是传统数据填报平台。它聚焦于一件事：
                  <Text strong>让改数据这件事变得安全、可控、可追溯。</Text>
                </Paragraph>

                <Title level={5}>解决的痛点</Title>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>原有方式</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>问题</th>
                      <th style={{ border: '1px solid #f0f0f0', padding: '8px 12px', textAlign: 'left' }}>工作台的解决方案</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>直接用 Navicat/SQL 改库</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>风险高，一条 UPDATE 写错不可逆</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>平台模板 + 校验预览 + 写前备份</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>线下 Excel 往返传递</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>版本混乱、人工复制粘贴出错</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>平台受控模板，杜绝任意 Excel</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>口头通知研发改数据</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>改了什么、谁改的，无从查证</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>全程操作留痕 + 逐字段变更日志</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>运维临时脚本处理</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>过程不透明，出问题难追溯</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>标准化流程 + 版本回退</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>每次改数据都找研发</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>研发变成"人肉接口"</td>
                      <td style={{ border: '1px solid #f0f0f0', padding: '8px 12px' }}>研发一次配置，用户反复使用</td>
                    </tr>
                  </tbody>
                </table>

                <Title level={5}>核心设计原则</Title>
                <Paragraph>
                  <ul>
                    <li><Text strong>安全第一</Text>：写前必校验、写前必预览、写前必备份、写后可回退</li>
                    <li><Text strong>平台模板机制</Text>：所有修订必须通过平台模板，杜绝任意 Excel 导入</li>
                    <li><Text strong>最小权限</Text>：三角色分权，普通用户不接触数据库连接信息</li>
                    <li><Text strong>一次配置反复使用</Text>：研发配好后，普通用户可独立完成日常维护</li>
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
