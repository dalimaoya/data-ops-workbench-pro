import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Space, Button, Input, Select, DatePicker, Modal, Tag,
  Descriptions, message, Typography, Row, Col,
} from 'antd';
import { ExclamationCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  listBackupVersions,
  getBackupVersionDetail,
  rollbackVersion,
  type BackupVersion,
  type BackupVersionDetail,
} from '../../api/backupVersion';
import { listDatasources } from '../../api/datasource';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function VersionRollback() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BackupVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [datasourceId, setDatasourceId] = useState<number | undefined>();
  const [tableName, setTableName] = useState('');
  const [operatorUser, setOperatorUser] = useState('');
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Datasource options
  const [dsOptions, setDsOptions] = useState<{ value: number; label: string }[]>([]);

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<BackupVersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Rollback modal
  const [rollbackTarget, setRollbackTarget] = useState<BackupVersion | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  useEffect(() => {
    listDatasources().then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setDsOptions(list.map((d: any) => ({ value: d.id, label: d.datasource_name })));
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (datasourceId) params.datasource_id = datasourceId;
      if (tableName) params.table_name = tableName;
      if (operatorUser) params.operator_user = operatorUser;
      if (timeRange) {
        params.start_time = timeRange[0].format('YYYY-MM-DDTHH:mm:ss');
        params.end_time = timeRange[1].format('YYYY-MM-DDTHH:mm:ss');
      }
      const res = await listBackupVersions(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('加载备份版本列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, datasourceId, tableName, operatorUser, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleViewDetail = async (record: BackupVersion) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const res = await getBackupVersionDetail(record.id);
      setDetail(res.data);
    } catch {
      message.error('加载版本详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRollback = (record: BackupVersion) => {
    setRollbackTarget(record);
  };

  const confirmRollback = async () => {
    if (!rollbackTarget) return;
    setRollbackLoading(true);
    try {
      const res = await rollbackVersion(rollbackTarget.id);
      message.success(res.data.message || '回退成功');
      setRollbackTarget(null);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '回退失败');
    } finally {
      setRollbackLoading(false);
    }
  };

  const columns: ColumnsType<BackupVersion> = [
    { title: '版本号', dataIndex: 'backup_version_no', width: 200 },
    { title: '数据源', dataIndex: 'datasource_name', width: 150 },
    { title: '表名', dataIndex: 'table_name', width: 150,
      render: (v, r) => r.table_alias ? `${r.table_alias}（${v}）` : v },
    { title: '备份时间', dataIndex: 'backup_time', width: 180 },
    { title: '触发类型', dataIndex: 'trigger_type', width: 140,
      render: v => {
        const map: Record<string, string> = {
          'triggered_by_writeback': '回写触发',
          'triggered_by_rollback': '回退前备份',
        };
        return map[v] || v;
      },
    },
    { title: '关联批次', dataIndex: 'related_writeback_batch_no', width: 200 },
    { title: '操作人', dataIndex: 'operator_user', width: 100 },
    { title: '记录数', dataIndex: 'record_count', width: 100 },
    {
      title: '可回退', dataIndex: 'can_rollback', width: 80,
      render: v => v ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>,
    },
    {
      title: '操作', fixed: 'right', width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            type="link" size="small"
            disabled={!record.can_rollback || record.storage_status !== 'valid'}
            onClick={() => handleRollback(record)}
            icon={<RollbackOutlined />}
          >
            回退
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title="版本回退" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col>
            <Select
              placeholder="数据源" allowClear style={{ width: 180 }}
              options={dsOptions}
              value={datasourceId}
              onChange={v => { setDatasourceId(v); setPage(1); }}
            />
          </Col>
          <Col>
            <Input placeholder="表名" allowClear style={{ width: 160 }}
              value={tableName}
              onChange={e => { setTableName(e.target.value); setPage(1); }}
            />
          </Col>
          <Col>
            <Input placeholder="操作人" allowClear style={{ width: 120 }}
              value={operatorUser}
              onChange={e => { setOperatorUser(e.target.value); setPage(1); }}
            />
          </Col>
          <Col>
            <RangePicker showTime
              value={timeRange}
              onChange={v => { setTimeRange(v as any); setPage(1); }}
            />
          </Col>
          <Col>
            <Button type="primary" onClick={() => { setPage(1); fetchData(); }}>查询</Button>
          </Col>
          <Col>
            <Button onClick={() => {
              setDatasourceId(undefined); setTableName(''); setOperatorUser(''); setTimeRange(null); setPage(1);
            }}>重置</Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true, pageSizeOptions: ['20', '50', '100'],
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="备份版本详情" open={detailVisible} width={700}
        onCancel={() => setDetailVisible(false)} footer={null}
        loading={detailLoading}
      >
        {detail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="版本号">{detail.backup_version_no}</Descriptions.Item>
            <Descriptions.Item label="数据源">{detail.datasource_name}</Descriptions.Item>
            <Descriptions.Item label="原表名">{detail.table_name}</Descriptions.Item>
            <Descriptions.Item label="备份表名">{detail.backup_table_name}</Descriptions.Item>
            <Descriptions.Item label="记录数">{detail.record_count}</Descriptions.Item>
            <Descriptions.Item label="存储状态">
              <Tag color={detail.storage_status === 'valid' ? 'green' : 'red'}>
                {detail.storage_status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="触发类型">{detail.trigger_type}</Descriptions.Item>
            <Descriptions.Item label="关联批次">{detail.related_writeback_batch_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="备份开始">{detail.backup_started_at || '-'}</Descriptions.Item>
            <Descriptions.Item label="备份结束">{detail.backup_finished_at || '-'}</Descriptions.Item>
            <Descriptions.Item label="操作人">{detail.operator_user}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{detail.created_at}</Descriptions.Item>
            {detail.remark && (
              <Descriptions.Item label="备注" span={2}>{detail.remark}</Descriptions.Item>
            )}
            {detail.writeback_info && (
              <>
                <Descriptions.Item label="回写批次" span={2}>
                  {detail.writeback_info.writeback_batch_no}
                  {' — '}
                  成功 {detail.writeback_info.success_row_count} / 失败 {detail.writeback_info.failed_row_count}
                  {' — '}
                  <Tag color={detail.writeback_info.writeback_status === 'success' ? 'green' : 'red'}>
                    {detail.writeback_info.writeback_status}
                  </Tag>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Rollback Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>确认回退</span>
          </Space>
        }
        open={!!rollbackTarget}
        onCancel={() => setRollbackTarget(null)}
        onOk={confirmRollback}
        confirmLoading={rollbackLoading}
        okText="确认回退"
        okButtonProps={{ danger: true }}
      >
        {rollbackTarget && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="目标表">{rollbackTarget.table_alias || rollbackTarget.table_name}</Descriptions.Item>
              <Descriptions.Item label="版本号">{rollbackTarget.backup_version_no}</Descriptions.Item>
              <Descriptions.Item label="备份时间">{rollbackTarget.backup_time}</Descriptions.Item>
              <Descriptions.Item label="备份记录数">{rollbackTarget.record_count} 条</Descriptions.Item>
            </Descriptions>
            <div style={{
              padding: '12px 16px', background: '#fff7e6', border: '1px solid #ffd591',
              borderRadius: 6, marginTop: 8,
            }}>
              <Text type="warning" strong>⚠️ 风险提示</Text>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>回退将清空目标表当前所有数据，并用备份版本的数据替换</li>
                <li>系统会在回退前自动备份当前数据</li>
                <li>请确认此操作不可逆，确认后将立即执行</li>
              </ul>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
