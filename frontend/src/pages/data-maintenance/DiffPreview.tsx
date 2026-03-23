import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Tag, Space, Button, Descriptions, message, Modal, Result } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { getImportDiff, executeWriteback, downloadDiffReport } from '../../api/dataMaintenance';
import type { DiffResponse, WritebackResult } from '../../api/dataMaintenance';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function DiffPreview() {
  const { t } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWriteback = user?.role === 'admin' || user?.role === 'operator';
  const tid = Number(taskId);

  const [loading, setLoading] = useState(false);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [writingBack, setWritingBack] = useState(false);
  const [writeResult, setWriteResult] = useState<WritebackResult | null>(null);

  useEffect(() => {
    setLoading(true);
    getImportDiff(tid)
      .then(res => setDiffData(res.data))
      .catch(() => message.error(t('diffPreview.diffFetchFailed')))
      .finally(() => setLoading(false));
  }, [tid]);

  const handleWriteback = () => {
    Modal.confirm({
      title: t('diffPreview.confirmWritebackTitle'),
      content: t('diffPreview.confirmWritebackContent'),
      okText: t('diffPreview.confirmWriteback'),
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        setWritingBack(true);
        try {
          const res = await executeWriteback(tid);
          setWriteResult(res.data);
          message.success(t('diffPreview.writebackComplete'));
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
          subTitle={`更新 ${writeResult.updated} 条，新增 ${writeResult.inserted} 条，失败 ${writeResult.failed} 条`}
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
            <Descriptions.Item label="更新行数">{writeResult.updated}</Descriptions.Item>
            <Descriptions.Item label="新增行数">{writeResult.inserted}</Descriptions.Item>
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
      render: (v: string | null, record: { change_type?: string }) =>
        record.change_type === 'insert'
          ? <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>
          : <span style={{ color: '#999' }}>{v ?? 'NULL'}</span>,
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      render: (v: string | null, record: { change_type?: string }) =>
        <span style={{ color: record.change_type === 'insert' ? '#52c41a' : '#1890ff', fontWeight: 500 }}>{v ?? 'NULL'}</span>,
    },
    {
      title: '类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 80,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          update: { color: 'orange', text: '更新' },
          insert: { color: 'green', text: '新增' },
        };
        const info = map[v] || { color: 'default', text: v };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
  ];

  // Count update vs insert diff rows
  const updateDiffCount = diffData?.diff_rows?.filter(d => d.change_type === 'update').length ?? 0;
  const insertDiffCount = diffData?.diff_rows?.filter(d => d.change_type === 'insert').length ?? 0;
  void insertDiffCount;

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} />
            <span>{t('diffPreview.title')}</span>
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
            <div style={{ color: '#666' }}>拟操作记录数</div>
          </Card>
          <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{updateDiffCount}</div>
            <div style={{ color: '#666' }}>更新差异项</div>
          </Card>
          {(diffData.new_count ?? 0) > 0 && (
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{diffData.new_count}</div>
              <div style={{ color: '#666' }}>新增行数</div>
            </Card>
          )}
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
          rowClassName={(record) => record.change_type === 'insert' ? 'ant-table-row-insert' : ''}
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            {diffData && diffData.diff_rows && diffData.diff_rows.length > 0 && (
              <Button
                icon={<DownloadOutlined />}
                onClick={async () => {
                  try {
                    const res = await downloadDiffReport(tid);
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `diff_report_${tid}.xlsx`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    message.success('对比报告已下载');
                  } catch {
                    message.error('下载对比报告失败');
                  }
                }}
              >
                导出对比报告
              </Button>
            )}
            <Button onClick={() => navigate(-1)}>返回校验结果</Button>
            <Button onClick={() => navigate(`/data-maintenance/browse/${diffData?.table_config_id}`)}>取消本次操作</Button>
            {canWriteback && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={writingBack}
                disabled={!diffData || diffData.failed_rows > 0}
                onClick={handleWriteback}
              >
                确认写入
              </Button>
            )}
            {diffData && diffData.failed_rows > 0 && (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>存在失败项，无法写入</span>
            )}
          </Space>
        </div>
      </Card>

      {/* Style for insert rows */}
      <style>{`
        .ant-table-row-insert td {
          background-color: #f6ffed !important;
        }
      `}</style>
    </div>
  );
}
