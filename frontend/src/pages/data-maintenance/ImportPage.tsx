import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Upload, Button, Space, message, Descriptions, Alert } from 'antd';
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { importTemplate } from '../../api/dataMaintenance';
import type { ImportResult } from '../../api/dataMaintenance';

const { Dragger } = Upload;

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tableConfigId = Number(id);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) {
      message.warning('请先选择文件');
      return;
    }
    setUploading(true);
    try {
      const res = await importTemplate(tableConfigId, file);
      setResult(res.data);
      if (res.data.validation_status === 'failed') {
        message.error('校验失败，请查看错误详情');
      } else {
        message.success('校验完成');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  if (result) {
    return (
      <div>
        <Card
          title={
            <Space>
              <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => setResult(null)} />
              <span>导入校验结果</span>
            </Space>
          }
        >
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold' }}>{result.total}</div>
              <div style={{ color: '#666' }}>总记录数</div>
            </Card>
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>{result.passed}</div>
              <div style={{ color: '#666' }}>通过</div>
            </Card>
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>{result.failed}</div>
              <div style={{ color: '#666' }}>失败</div>
            </Card>
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#faad14' }}>{result.warnings}</div>
              <div style={{ color: '#666' }}>警告</div>
            </Card>
            <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>{result.diff_count}</div>
              <div style={{ color: '#666' }}>差异项</div>
            </Card>
          </div>

          {/* Validation status */}
          {result.validation_status === 'failed' && (
            <Alert type="error" message="校验失败，请修正后重新上传" style={{ marginBottom: 16 }} />
          )}
          {result.validation_status === 'partial' && (
            <Alert type="warning" message="部分记录校验失败，通过的记录可继续操作" style={{ marginBottom: 16 }} />
          )}
          {result.validation_status === 'success' && (
            <Alert type="success" message="全部校验通过" style={{ marginBottom: 16 }} />
          )}

          {/* Error details */}
          {result.errors.length > 0 && (
            <Card title="错误明细" size="small" style={{ marginBottom: 16 }}>
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>行号</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>字段</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>类型</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>当前值</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{e.row}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{e.field}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{e.type}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{e.value || '-'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Space>
            {result.validation_status !== 'failed' && result.passed > 0 && (
              <Button type="primary" onClick={() => navigate(`/data-maintenance/diff/${result.task_id}`)}>
                查看差异预览
              </Button>
            )}
            <Button onClick={() => { setResult(null); setFile(null); }}>重新上传</Button>
            <Button onClick={() => navigate(`/data-maintenance/browse/${tableConfigId}`)}>返回数据浏览</Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(`/data-maintenance/browse/${tableConfigId}`)} />
          <span>模板导入</span>
        </Space>
      }
    >
      <Dragger
        accept=".xlsx,.xls"
        maxCount={1}
        beforeUpload={(f) => {
          setFile(f);
          return false;
        }}
        onRemove={() => setFile(null)}
        fileList={file ? [{ uid: '-1', name: file.name, status: 'done' }] : []}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">仅支持平台导出的 .xlsx 模板文件</p>
      </Dragger>

      {file && (
        <Descriptions style={{ marginTop: 16 }} column={2} size="small" bordered>
          <Descriptions.Item label="文件名">{file.name}</Descriptions.Item>
          <Descriptions.Item label="大小">{(file.size / 1024).toFixed(1)} KB</Descriptions.Item>
        </Descriptions>
      )}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={() => navigate(`/data-maintenance/browse/${tableConfigId}`)}>返回</Button>
          <Button type="primary" onClick={handleUpload} loading={uploading} disabled={!file}>
            开始校验
          </Button>
        </Space>
      </div>
    </Card>
  );
}
