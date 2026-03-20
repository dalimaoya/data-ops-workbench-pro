import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Space, Button, Descriptions, message, Modal, Result } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getImportDiff, executeWriteback } from '../../api/dataMaintenance';
import type { DiffResponse, WritebackResult } from '../../api/dataMaintenance';

export default function DiffPreview() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const tid = Number(taskId);

  const [loading, setLoading] = useState(false);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [writingBack, setWritingBack] = useState(false);
  const [writeResult, setWriteResult] = useState<WritebackResult | null>(null);

  useEffect(() => {
    setLoading(true);
    getImportDiff(tid)
      .then(res => setDiffData(res.data))
      .catch(() => message.error('获取差异数据失败'))
      .finally(() => setLoading(false));
  }, [tid]);

  const handleWriteback = () => {
    Modal.confirm({
      title: '确认写入',
      content: '确认将差异数据写入业务数据库？写入前将自动备份全表。',
      okText: '确认写入',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        setWritingBack(true);
        try {
          const res = await executeWriteback(tid);
          setWriteResult(res.data);
          message.success('回写完成');
        } catch (e: unknown) {
          const err = e as { response?: { data?: { detail?: string } } };
          message.error(err?.response?.data?.detail || '回写失败');
        } finally {
          setWritingBack(false);
        }
      },
    });
  };

  // Write result view
  if (writeResult) {
    return (
      <Card>
        <Result
          status={writeResult.status === 'success' ? 'success' : writeResult.status === 'failed' ? 'error' : 'warning'}
          title={writeResult.status === 'success' ? '写入成功' : writeResult.status === 'failed' ? '写入失败' : '部分写入成功'}
          subTitle={`成功 ${writeResult.success} 条，失败 ${writeResult.failed} 条`}
          extra={[
            <Button key="back" onClick={() => navigate(`/data-maintenance/browse/${diffData?.table_config_id}`)}>
              返回数据浏览
            </Button>,
            <Button key="home" type="primary" onClick={() => navigate('/data-maintenance')}>
              返回数据维护
            </Button>,
          ]}
        >
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="回写批次号">{writeResult.writeback_batch_no}</Descriptions.Item>
            <Descriptions.Item label="备份版本号">{writeResult.backup_version_no}</Descriptions.Item>
            <Descriptions.Item label="备份表名">{writeResult.backup_table}</Descriptions.Item>
            <Descriptions.Item label="备份记录数">{writeResult.backup_record_count}</Descriptions.Item>
            <Descriptions.Item label="操作人">{writeResult.operator_user}</Descriptions.Item>
            <Descriptions.Item label="完成时间">{writeResult.finished_at}</Descriptions.Item>
          </Descriptions>

          {writeResult.failed_details && writeResult.failed_details.length > 0 && (
            <Card title="失败明细" size="small" style={{ marginTop: 16 }}>
              {writeResult.failed_details.map((d, i) => (
                <div key={i} style={{ color: '#ff4d4f', fontSize: 13 }}>
                  行{d.row_num} (PK: {d.pk_key}): {d.error}
                </div>
              ))}
            </Card>
          )}
        </Result>
      </Card>
    );
  }

  const diffColumns = [
    { title: '行号', dataIndex: 'row_num', key: 'row_num', width: 70 },
    { title: '主键值', dataIndex: 'pk_key', key: 'pk_key', width: 150 },
    { title: '字段名', dataIndex: 'field_alias', key: 'field_alias', width: 150 },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      render: (v: string | null) => <span style={{ color: '#999' }}>{v ?? 'NULL'}</span>,
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      render: (v: string | null) => <span style={{ color: '#1890ff', fontWeight: 500 }}>{v ?? 'NULL'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={v === 'changed' ? 'orange' : 'default'}>{v === 'changed' ? '已变更' : v}</Tag>,
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} />
            <span>差异预览</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {diffData && (
          <Descriptions column={4} size="small">
            <Descriptions.Item label="表名">{diffData.table_alias || diffData.table_name}</Descriptions.Item>
            <Descriptions.Item label="批次号">{diffData.import_batch_no}</Descriptions.Item>
            <Descriptions.Item label="配置版本">v{diffData.config_version}</Descriptions.Item>
            <Descriptions.Item label="导入人">{diffData.operator_user}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* Summary cards */}
      {diffData && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{diffData.passed_rows}</div>
            <div style={{ color: '#666' }}>拟更新记录数</div>
          </Card>
          <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{diffData.diff_count}</div>
            <div style={{ color: '#666' }}>差异项数</div>
          </Card>
          <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{diffData.failed_rows}</div>
            <div style={{ color: '#666' }}>失败记录数</div>
          </Card>
        </div>
      )}

      <Card>
        <Table
          rowKey={(_r, i) => String(i)}
          columns={diffColumns}
          dataSource={diffData?.diff_rows || []}
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 50, showTotal: t => `共 ${t} 处差异` }}
          size="small"
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate(-1)}>返回校验结果</Button>
            <Button onClick={() => navigate(`/data-maintenance/browse/${diffData?.table_config_id}`)}>取消本次操作</Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={writingBack}
              disabled={!diffData || diffData.failed_rows > 0}
              onClick={handleWriteback}
            >
              确认写入
            </Button>
            {diffData && diffData.failed_rows > 0 && (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>存在失败项，无法写入</span>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
}
