import { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Tabs, Modal, Input, message, Descriptions, Switch, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, SettingOutlined,
} from '@ant-design/icons';
import {
  listApprovals, getApprovalDetail, approveRequest, rejectRequest,
  getApprovalEnabled, setApprovalEnabled,
} from '../../api/approvals';
import type { ApprovalItem, ApprovalDetail } from '../../api/approvals';
import { formatBeijingTime } from '../../utils/formatTime';
import { useTranslation } from 'react-i18next';

const requestTypeLabels: Record<string, string> = {
  writeback: '模板回写',
  delete: '删除行',
  batch_insert: '批量新增',
  inline_update: '在线编辑',
  inline_insert: '在线新增',
};

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const statusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
};

export default function ApprovalCenter() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pending');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [, setDetailLoading] = useState(false);

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Approval enabled switch
  const [approvalEnabled, setApprovalEnabledState] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await listApprovals({ status: activeTab, page, page_size: pageSize });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch {
      message.error('获取审批列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSwitch = async () => {
    try {
      const res = await getApprovalEnabled();
      setApprovalEnabledState(res.data.approval_enabled);
    } catch {
      // ignore
    }
  };

  useEffect(() => { fetchData(); }, [activeTab, page]);
  useEffect(() => { fetchSwitch(); }, []);

  const handleApprove = async (id: number) => {
    Modal.confirm({
      title: '确认审批通过？',
      content: '通过后将自动执行对应操作（备份+写入）',
      onOk: async () => {
        try {
          await approveRequest(id);
          message.success('审批已通过，操作已执行');
          fetchData();
        } catch (err: any) {
          message.error(err?.response?.data?.detail || '审批失败');
        }
      },
    });
  };

  const handleRejectConfirm = async () => {
    if (rejectId === null) return;
    setRejectLoading(true);
    try {
      await rejectRequest(rejectId, rejectReason);
      message.success('审批已拒绝');
      setRejectOpen(false);
      setRejectReason('');
      setRejectId(null);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await getApprovalDetail(id);
      setDetail(res.data);
    } catch {
      message.error('获取审批详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSwitchChange = async (checked: boolean) => {
    setSwitchLoading(true);
    try {
      await setApprovalEnabled(checked);
      setApprovalEnabledState(checked);
      message.success(checked ? '审批流已启用' : '审批流已关闭');
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '设置失败');
    } finally {
      setSwitchLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '操作类型', dataIndex: 'request_type', key: 'request_type', width: 100,
      render: (v: string) => <Tag>{requestTypeLabels[v] || v}</Tag>,
    },
    { title: '表名', dataIndex: 'table_alias', key: 'table_alias', width: 150,
      render: (v: string, r: ApprovalItem) => v || r.table_name,
    },
    { title: '数据源', dataIndex: 'datasource_name', key: 'datasource_name', width: 120 },
    { title: '申请人', dataIndex: 'requested_by', key: 'requested_by', width: 100 },
    {
      title: '申请时间', dataIndex: 'request_time', key: 'request_time', width: 170,
      render: (v: string) => formatBeijingTime(v),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    ...(activeTab === 'approved' || activeTab === 'rejected' ? [
      { title: '审批人', dataIndex: 'approved_by', key: 'approved_by', width: 100 },
      {
        title: '审批时间', dataIndex: 'approve_time', key: 'approve_time', width: 170,
        render: (v: string) => formatBeijingTime(v),
      },
    ] : []),
    ...(activeTab === 'rejected' ? [
      { title: '拒绝原因', dataIndex: 'reject_reason', key: 'reject_reason', width: 200 },
    ] : []),
    {
      title: '操作', key: 'action', width: activeTab === 'pending' ? 220 : 80,
      render: (_: unknown, record: ApprovalItem) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
              详情
            </Button>
          </Tooltip>
          {activeTab === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => { setRejectId(record.id); setRejectOpen(true); }}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={t('approval.title')}
        extra={
          <Space>
            <SettingOutlined />
            <span>审批流：</span>
            <Switch
              checked={approvalEnabled}
              loading={switchLoading}
              onChange={handleSwitchChange}
              checkedChildren="启用"
              unCheckedChildren="关闭"
            />
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => { setActiveTab(k); setPage(1); }}
          items={[
            { key: 'pending', label: '待审批' },
            { key: 'approved', label: '已通过' },
            { key: 'rejected', label: '已拒绝' },
          ]}
        />
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
          size="middle"
        />
      </Card>

      {/* Detail modal */}
      <Modal
        title={`审批详情 #${detail?.id || ''}`}
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetail(null); }}
        footer={null}
        width={700}
      >
        {detail && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="操作类型">{requestTypeLabels[detail.request_type] || detail.request_type}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[detail.status]}>{statusLabels[detail.status] || detail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="表名">{detail.table_alias || detail.table_name}</Descriptions.Item>
            <Descriptions.Item label="数据源">{detail.datasource_name}</Descriptions.Item>
            <Descriptions.Item label="申请人">{detail.requested_by}</Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatBeijingTime(detail.request_time)}</Descriptions.Item>
            {detail.approved_by && (
              <>
                <Descriptions.Item label="审批人">{detail.approved_by}</Descriptions.Item>
                <Descriptions.Item label="审批时间">{formatBeijingTime(detail.approve_time)}</Descriptions.Item>
              </>
            )}
            {detail.reject_reason && (
              <Descriptions.Item label="拒绝原因" span={2}>{detail.reject_reason}</Descriptions.Item>
            )}
            {detail.diff_preview && detail.diff_preview.diff_rows && detail.diff_preview.diff_rows.length > 0 && (
              <Descriptions.Item label="差异预览" span={2}>
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={detail.diff_preview.diff_rows.map((r: any, i: number) => ({ ...r, _key: i }))}
                    rowKey="_key"
                    columns={[
                      { title: '主键', dataIndex: 'pk_key', width: 100 },
                      { title: '字段', dataIndex: 'field_alias', width: 100 },
                      {
                        title: '原值', dataIndex: 'old_value', width: 120,
                        render: (v: string) => <span style={{ color: '#999' }}>{v ?? '-'}</span>,
                      },
                      {
                        title: '新值', dataIndex: 'new_value', width: 120,
                        render: (v: string) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{v ?? '-'}</span>,
                      },
                      {
                        title: '类型', dataIndex: 'change_type', width: 80,
                        render: (v: string) => (
                          <Tag color={v === 'insert' ? 'green' : v === 'update' ? 'blue' : 'default'}>{v}</Tag>
                        ),
                      },
                    ]}
                  />
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Reject modal */}
      <Modal
        title="拒绝审批"
        open={rejectOpen}
        onOk={handleRejectConfirm}
        onCancel={() => { setRejectOpen(false); setRejectReason(''); setRejectId(null); }}
        confirmLoading={rejectLoading}
        destroyOnClose
      >
        <Input.TextArea
          placeholder="请输入拒绝原因（可选）"
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
