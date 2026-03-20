import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table, Card, Input, Button, Space, message, Select, Row, Col, Descriptions, Tag, Modal, Radio,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined, UploadOutlined, ReloadOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { browseTableData, getExportInfo, exportTemplate } from '../../api/dataMaintenance';
import type { ColumnMeta } from '../../api/dataMaintenance';
import { getTableConfig } from '../../api/tableConfig';

export default function DataBrowse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tableConfigId = Number(id);

  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [rows, setRows] = useState<Record<string, string | null>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [filterField, setFilterField] = useState<string>();
  const [filterValue, setFilterValue] = useState('');
  const [tableInfo, setTableInfo] = useState<Record<string, unknown>>({});

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'current'>('all');
  const [exportInfo, setExportInfo] = useState<Record<string, unknown>>({});
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fieldFilters: Record<string, string> = {};
      if (filterField && filterValue) {
        fieldFilters[filterField] = filterValue;
      }
      const res = await browseTableData(tableConfigId, {
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        field_filters: Object.keys(fieldFilters).length ? JSON.stringify(fieldFilters) : undefined,
      });
      setColumns(res.data.columns);
      setRows(res.data.rows);
      setTotal(res.data.total);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [tableConfigId, page, pageSize, keyword, filterField, filterValue]);

  useEffect(() => {
    getTableConfig(tableConfigId).then(res => setTableInfo(res.data as unknown as Record<string, unknown>)).catch(() => {});
    fetchData();
  }, [tableConfigId]);

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchData(); };

  const tableColumns = columns.map((col) => ({
    title: col.field_alias,
    dataIndex: col.field_name,
    key: col.field_name,
    fixed: col.is_primary_key ? 'left' as const : undefined,
    width: col.is_primary_key ? 120 : 150,
    render: (v: string | null) => v ?? <span style={{ color: '#ccc' }}>NULL</span>,
    ...(col.is_primary_key ? {
      title: <span>{col.field_alias} <Tag color="blue" style={{ fontSize: 10 }}>PK</Tag></span>,
    } : {}),
  }));

  const handleExportClick = async () => {
    try {
      const res = await getExportInfo(tableConfigId);
      setExportInfo(res.data as unknown as Record<string, unknown>);
      setExportModalOpen(true);
    } catch {
      message.error('获取导出信息失败');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const fieldFilters: Record<string, string> = {};
      if (filterField && filterValue) fieldFilters[filterField] = filterValue;
      const res = await exportTemplate(tableConfigId, {
        export_type: exportType,
        keyword: exportType === 'current' ? keyword || undefined : undefined,
        field_filters: exportType === 'current' && Object.keys(fieldFilters).length ? JSON.stringify(fieldFilters) : undefined,
      });
      // Download blob
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'];
      let filename = `export_${tableConfigId}.xlsx`;
      if (disposition) {
        const m = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
        if (m) filename = decodeURIComponent(m[1].replace(/"/g, ''));
      }
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
      setExportModalOpen(false);
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/data-maintenance')} />
            <span>数据浏览 - {(tableInfo as { table_alias?: string }).table_alias || (tableInfo as { table_name?: string }).table_name || ''}</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="数据源">{(tableInfo as { datasource_name?: string }).datasource_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="表名">{(tableInfo as { table_name?: string }).table_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="配置版本">v{String((tableInfo as { config_version?: number }).config_version || 0)}</Descriptions.Item>
          <Descriptions.Item label="结构状态">
            <Tag color={(tableInfo as { structure_check_status?: string }).structure_check_status === 'normal' ? 'green' : 'red'}>
              {(tableInfo as { structure_check_status?: string }).structure_check_status || '-'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Space wrap>
              <Input
                placeholder="全局关键字搜索"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                placeholder="按字段筛选"
                allowClear
                style={{ width: 160 }}
                value={filterField}
                onChange={v => setFilterField(v)}
                options={columns.map(c => ({ value: c.field_name, label: c.field_alias }))}
              />
              {filterField && (
                <Input
                  placeholder={`${columns.find(c => c.field_name === filterField)?.field_alias || ''}的值`}
                  value={filterValue}
                  onChange={e => setFilterValue(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 180 }}
                  allowClear
                />
              )}
              <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>查询</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setFilterField(undefined); setFilterValue(''); setPage(1); setTimeout(fetchData, 0); }}>重置</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExportClick}>导出模板</Button>
              <Button icon={<UploadOutlined />} onClick={() => navigate(`/data-maintenance/import/${tableConfigId}`)}>上传修订模板</Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey={(_r, i) => String(i)}
          columns={tableColumns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: Math.max(columns.length * 150, 800) }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showTotal: (t) => `共 ${t} 条`,
          }}
          size="small"
        />
      </Card>

      {/* Export Modal */}
      <Modal
        title="导出确认"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        onOk={handleExport}
        confirmLoading={exporting}
        okText="确认导出"
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>导出类型：</strong></p>
          <Radio.Group value={exportType} onChange={e => setExportType(e.target.value)}>
            <Radio value="all">全量数据</Radio>
            <Radio value="current">当前筛选</Radio>
          </Radio.Group>
        </div>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="数据行数（预估）">{String((exportInfo as { estimated_rows?: number }).estimated_rows ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="导出字段数">{String((exportInfo as { field_count?: number }).field_count ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="配置版本">v{String((exportInfo as { config_version?: number }).config_version ?? 0)}</Descriptions.Item>
        </Descriptions>
        <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          说明：仅支持使用平台导出的模板回传，请勿修改模板中字段顺序与隐藏信息。
        </p>
      </Modal>
    </div>
  );
}
