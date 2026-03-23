import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table, Card, Input, Button, Space, message, Select, Row, Col, Descriptions, Tag, Modal, Radio, Typography,
} from 'antd';
const { Text } = Typography;
import {
  SearchOutlined, DownloadOutlined, UploadOutlined, ReloadOutlined, ArrowLeftOutlined,
  DeleteOutlined, ExclamationCircleOutlined, EditOutlined, PlusOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons';
import { browseTableData, getExportInfo, exportTemplate, deleteRows, inlineUpdate, batchInsert, asyncExport } from '../../api/dataMaintenance';
import type { ColumnMeta, InlineChange } from '../../api/dataMaintenance';
import { getTableConfig } from '../../api/tableConfig';
import { useAuth } from '../../context/AuthContext';

export default function DataBrowse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'operator';
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
  const [allowDelete, setAllowDelete] = useState(false);
  const [allowInsert, setAllowInsert] = useState(false);

  // Row selection for delete
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'current'>('all');
  const [exportInfo, setExportInfo] = useState<Record<string, unknown>>({});
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PK fields for building pk_key
  const [pkFieldNames, setPkFieldNames] = useState<string[]>([]);

  // v2.1: Inline editing
  const [editMode, setEditMode] = useState(false);
  const [editedCells, setEditedCells] = useState<Record<string, Record<string, string | null>>>({});
  // editedCells: { pkKey: { fieldName: newValue, ... }, ... }
  const [saving, setSaving] = useState(false);

  // v2.1.2: Batch insert modal
  const [batchInsertOpen, setBatchInsertOpen] = useState(false);
  const [batchRows, setBatchRows] = useState<Record<string, string | null>[]>([]);
  const [insertSaving, setInsertSaving] = useState(false);

  // Diff preview modal
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffData, setDiffData] = useState<Array<{ pk_key: string; field_name: string; field_alias: string; old_value: string | null; new_value: string | null }>>([]);

  const originalRowsRef = useRef<Record<string, Record<string, string | null>>>({});

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
      setAllowDelete(!!res.data.allow_delete_rows);
      // Identify PK fields
      const pks = res.data.columns.filter(c => c.is_primary_key).map(c => c.field_name);
      setPkFieldNames(pks);
      // Build original rows map for diff
      const origMap: Record<string, Record<string, string | null>> = {};
      for (const row of res.data.rows) {
        const pkKey = pks.map(pk => row[pk] ?? '').join('|');
        origMap[pkKey] = { ...row };
      }
      originalRowsRef.current = origMap;
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [tableConfigId, page, pageSize, keyword, filterField, filterValue]);

  useEffect(() => {
    getTableConfig(tableConfigId).then(res => {
      const d = res.data as unknown as Record<string, unknown>;
      setTableInfo(d);
      setAllowInsert(!!(d as { allow_insert_rows?: number }).allow_insert_rows);
    }).catch(() => {});
    fetchData();
  }, [tableConfigId]);

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); fetchData(); };

  // Build PK key for a row
  const buildPkKey = (row: Record<string, string | null>) =>
    pkFieldNames.map(pk => row[pk] ?? '').join('|');

  // Build pk_values dict for a row
  const buildPkValues = (row: Record<string, string | null>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const pk of pkFieldNames) {
      result[pk] = row[pk] ?? '';
    }
    return result;
  };

  // Handle cell edit
  const handleCellChange = (pkKey: string, fieldName: string, value: string | null) => {
    setEditedCells(prev => ({
      ...prev,
      [pkKey]: {
        ...(prev[pkKey] || {}),
        [fieldName]: value,
      },
    }));
  };

  // Check if a cell was modified
  const isCellModified = (pkKey: string, fieldName: string): boolean => {
    const edited = editedCells[pkKey]?.[fieldName];
    if (edited === undefined) return false;
    const original = originalRowsRef.current[pkKey]?.[fieldName] ?? null;
    return edited !== original;
  };

  // Get display value (edited or original)
  const getCellValue = (pkKey: string, fieldName: string, originalValue: string | null): string | null => {
    const edited = editedCells[pkKey]?.[fieldName];
    return edited !== undefined ? edited : originalValue;
  };

  // Count total changes
  const getChangeCount = (): number => {
    let count = 0;
    for (const pkKey of Object.keys(editedCells)) {
      for (const fn of Object.keys(editedCells[pkKey])) {
        if (isCellModified(pkKey, fn)) count++;
      }
    }
    return count;
  };

  // Collect changes for API
  const collectChanges = (): InlineChange[] => {
    const changes: InlineChange[] = [];
    for (const pkKey of Object.keys(editedCells)) {
      const updates: Record<string, string | null> = {};
      for (const fn of Object.keys(editedCells[pkKey])) {
        if (isCellModified(pkKey, fn)) {
          updates[fn] = editedCells[pkKey][fn];
        }
      }
      if (Object.keys(updates).length > 0) {
        const origRow = originalRowsRef.current[pkKey];
        if (origRow) {
          changes.push({
            pk_values: buildPkValues(origRow),
            updates,
          });
        }
      }
    }
    return changes;
  };

  // Build diff data for preview
  const buildDiffData = () => {
    const diffs: typeof diffData = [];
    for (const pkKey of Object.keys(editedCells)) {
      for (const fn of Object.keys(editedCells[pkKey])) {
        if (isCellModified(pkKey, fn)) {
          const col = columns.find(c => c.field_name === fn);
          diffs.push({
            pk_key: pkKey,
            field_name: fn,
            field_alias: col?.field_alias || fn,
            old_value: originalRowsRef.current[pkKey]?.[fn] ?? null,
            new_value: editedCells[pkKey][fn],
          });
        }
      }
    }
    return diffs;
  };

  // Enter edit mode
  const handleEnterEditMode = () => {
    setEditMode(true);
    setEditedCells({});
    setSelectedRowKeys([]);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    if (getChangeCount() > 0) {
      Modal.confirm({
        title: '放弃修改',
        content: `有 ${getChangeCount()} 处未保存的修改，确定要放弃吗？`,
        okText: '确定放弃',
        cancelText: '继续编辑',
        onOk: () => {
          setEditMode(false);
          setEditedCells({});
        },
      });
    } else {
      setEditMode(false);
      setEditedCells({});
    }
  };

  // Save edits — show diff preview first
  const handleSaveClick = () => {
    const changes = collectChanges();
    if (changes.length === 0) {
      message.info('没有需要保存的修改');
      return;
    }
    setDiffData(buildDiffData());
    setDiffModalOpen(true);
  };

  // Confirm save
  const handleConfirmSave = async () => {
    const changes = collectChanges();
    setSaving(true);
    try {
      const res = await inlineUpdate(tableConfigId, changes);
      if (res.data.status === 'success') {
        message.success(`成功更新 ${res.data.updated} 行，共 ${res.data.change_count} 处变更`);
      } else {
        message.warning(`更新 ${res.data.success} 行，失败 ${res.data.failed} 行`);
      }
      setDiffModalOpen(false);
      setEditMode(false);
      setEditedCells({});
      fetchData();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // v2.1.2: Batch insert modal
  const createEmptyRows = (count: number): Record<string, string | null>[] => {
    return Array.from({ length: count }, () => {
      const row: Record<string, string | null> = {};
      for (const col of columns) {
        row[col.field_name] = null;
      }
      return row;
    });
  };

  const handleAddRow = () => {
    setBatchRows(createEmptyRows(5));
    setBatchInsertOpen(true);
  };

  const handleAddMoreRows = () => {
    setBatchRows(prev => [...prev, ...createEmptyRows(5)]);
  };

  const handleBatchCellChange = (rowIndex: number, fieldName: string, value: string | null) => {
    setBatchRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [fieldName]: value };
      return next;
    });
  };

  const handleBatchPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\t')) return; // Not tab-separated data

    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    // Get editable column field names in order (matching table header order)
    const editableFields = columns
      .filter(c => !c.is_system_field)
      .map(c => c.field_name);

    setBatchRows(prev => {
      const newRows = [...prev];
      // Ensure enough rows
      while (newRows.length < lines.length) {
        const row: Record<string, string | null> = {};
        for (const col of columns) {
          row[col.field_name] = null;
        }
        newRows.push(row);
      }
      // Fill data
      for (let i = 0; i < lines.length; i++) {
        const cells = lines[i].split('\t');
        for (let j = 0; j < cells.length && j < editableFields.length; j++) {
          const val = cells[j].trim();
          newRows[i] = { ...newRows[i], [editableFields[j]]: val || null };
        }
      }
      return newRows;
    });
    message.success(`已粘贴 ${lines.length} 行数据`);
  };

  const handleConfirmBatchInsert = async () => {
    // Filter out empty rows
    const validRows = batchRows.filter(row =>
      Object.values(row).some(v => v !== null && String(v).trim() !== '')
    );
    if (validRows.length === 0) {
      message.warning('没有填写任何数据');
      return;
    }
    // Validate PK fields
    for (let i = 0; i < validRows.length; i++) {
      for (const pk of pkFieldNames) {
        if (!validRows[i][pk] || String(validRows[i][pk]).trim() === '') {
          const col = columns.find(c => c.field_name === pk);
          message.warning(`第 ${i + 1} 行主键字段「${col?.field_alias || pk}」不能为空`);
          return;
        }
      }
    }
    setInsertSaving(true);
    try {
      const res = await batchInsert(tableConfigId, validRows);
      if (res.data.status === 'success') {
        message.success(`成功新增 ${res.data.success} 行`);
      } else {
        message.warning(`新增 ${res.data.success} 行，失败 ${res.data.failed} 行`);
      }
      setBatchInsertOpen(false);
      setBatchRows([]);
      fetchData();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err?.response?.data?.detail || '批量新增失败');
    } finally {
      setInsertSaving(false);
    }
  };

  const tableColumns = columns.map((col) => {
    const baseCol = {
      title: col.is_primary_key
        ? <span>{col.field_alias} <Tag color="blue" style={{ fontSize: 10 }}>PK</Tag></span>
        : col.field_alias,
      dataIndex: col.field_name,
      key: col.field_name,
      fixed: col.is_primary_key ? 'left' as const : undefined,
      width: col.is_primary_key ? 120 : 150,
    };

    if (editMode) {
      return {
        ...baseCol,
        render: (v: string | null, record: Record<string, string | null>) => {
          const pkKey = buildPkKey(record);
          const isEditable = col.is_editable && !col.is_primary_key && !col.is_system_field;
          const currentValue = getCellValue(pkKey, col.field_name, v);
          const modified = isCellModified(pkKey, col.field_name);

          if (!isEditable) {
            return <span style={{ color: '#999', background: '#f5f5f5', padding: '2px 6px', borderRadius: 2 }}>{v ?? <span style={{ color: '#ccc' }}>NULL</span>}</span>;
          }

          return (
            <Input
              size="small"
              value={currentValue ?? ''}
              onChange={(e) => handleCellChange(pkKey, col.field_name, e.target.value || null)}
              style={{
                background: modified ? '#fffbe6' : undefined,
                borderColor: modified ? '#faad14' : undefined,
              }}
            />
          );
        },
      };
    }

    return {
      ...baseCol,
      render: (v: string | null) => v ?? <span style={{ color: '#ccc' }}>NULL</span>,
    };
  });

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
      const estimatedRows = (exportInfo as { estimated_rows?: number }).estimated_rows ?? 0;
      const fieldFilters: Record<string, string> = {};
      if (filterField && filterValue) fieldFilters[filterField] = filterValue;

      if (estimatedRows > 5000) {
        // Async export for large tables
        await asyncExport(tableConfigId, {
          export_type: exportType,
          keyword: exportType === 'current' ? keyword || undefined : undefined,
          field_filters: exportType === 'current' && Object.keys(fieldFilters).length ? JSON.stringify(fieldFilters) : undefined,
        });
        message.success('导出任务已创建，将在后台执行，完成后可在日志中心的导出日志中下载');
        setExportModalOpen(false);
      } else {
        // Sync export for small tables
        const res = await exportTemplate(tableConfigId, {
          export_type: exportType,
          keyword: exportType === 'current' ? keyword || undefined : undefined,
          field_filters: exportType === 'current' && Object.keys(fieldFilters).length ? JSON.stringify(fieldFilters) : undefined,
        });
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
      }
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  // v2.0: Delete selected rows
  const handleDeleteRows = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的行');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedRowKeys.length} 行数据吗？删除前将自动备份全表。此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          const res = await deleteRows(tableConfigId, selectedRowKeys);
          if (res.data.status === 'success') {
            message.success(`成功删除 ${res.data.deleted} 行`);
          } else {
            message.warning(`删除 ${res.data.deleted} 行，失败 ${res.data.failed} 行`);
          }
          setSelectedRowKeys([]);
          fetchData();
        } catch (e: unknown) {
          const err = e as { response?: { data?: { detail?: string } } };
          message.error(err?.response?.data?.detail || '删除失败');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  // Row selection config
  const rowSelection = (!editMode && canOperate && allowDelete) ? {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  } : undefined;

  // (batch insert modal replaces inline new-row)

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/data-maintenance')} />
            <span>数据浏览 - {(tableInfo as { table_alias?: string }).table_alias || (tableInfo as { table_name?: string }).table_name || ''}</span>
            {editMode && <Tag color="orange">编辑模式</Tag>}
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="数据源">{(tableInfo as { datasource_name?: string }).datasource_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="表名">{(tableInfo as { table_name?: string }).table_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="配置版本">v{String((tableInfo as { config_version?: number }).config_version || 0)}</Descriptions.Item>
          <Descriptions.Item label="结构状态">
            {(() => {
              const status = (tableInfo as { structure_check_status?: string }).structure_check_status;
              const map: Record<string, { color: string; text: string }> = {
                normal: { color: 'green', text: '正常' },
                changed: { color: 'red', text: '已变化' },
                error: { color: 'orange', text: '检查失败' },
              };
              const info = map[status || ''] || { color: 'default', text: status || '-' };
              return <Tag color={info.color}>{info.text}</Tag>;
            })()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            {!editMode ? (
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
            ) : (
              <Space>
                <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
                  编辑模式 — 修改后的单元格会高亮标记
                </Tag>
                {getChangeCount() > 0 && (
                  <Tag color="blue">{getChangeCount()} 处修改</Tag>
                )}
              </Space>
            )}
          </Col>
          <Col>
            <Space>
              {editMode ? (
                <>
                  <Button
                    icon={<SaveOutlined />}
                    type="primary"
                    loading={saving}
                    onClick={handleSaveClick}
                    disabled={getChangeCount() === 0}
                  >
                    保存修改 ({getChangeCount()})
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>取消</Button>
                </>
              ) : (
                <>
                  {canOperate && (
                    <Button icon={<EditOutlined />} onClick={handleEnterEditMode}>编辑模式</Button>
                  )}
                  {canOperate && allowInsert && !editMode && (
                    <Button icon={<PlusOutlined />} onClick={handleAddRow}>新增行</Button>
                  )}
                  {canOperate && allowDelete && selectedRowKeys.length > 0 && (
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      loading={deleting}
                      onClick={handleDeleteRows}
                    >
                      删除选中行 ({selectedRowKeys.length})
                    </Button>
                  )}
                  <Button icon={<DownloadOutlined />} onClick={handleExportClick}>导出模板</Button>
                  {canOperate && <Button icon={<UploadOutlined />} onClick={() => navigate(`/data-maintenance/import/${tableConfigId}`)}>上传修订模板</Button>}
                </>
              )}
            </Space>
          </Col>
        </Row>

        {/* Batch insert area intentionally left empty — now uses Modal below */}

        <Table
          rowKey={(r) => r.__isNewRow ? '__new__' : buildPkKey(r)}
          columns={tableColumns}
          dataSource={rows}
          loading={loading}
          rowSelection={rowSelection}
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
        {((exportInfo as { estimated_rows?: number }).estimated_rows ?? 0) > 5000 && (
          <p style={{ marginTop: 12, color: '#fa8c16', fontSize: 13, fontWeight: 500 }}>
            ⚠ 数据量较大（超过 5000 行），将在后台生成，完成后可在导出记录中下载。
          </p>
        )}
        <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
          说明：仅支持使用平台导出的模板回传，请勿修改模板中字段顺序与隐藏信息。
        </p>
      </Modal>

      {/* Batch Insert Modal (v2.1.2) */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>批量新增行</span>
            <Tag color="green">{batchRows.filter(r => Object.values(r).some(v => v !== null && String(v).trim() !== '')).length} 行有数据</Tag>
          </Space>
        }
        open={batchInsertOpen}
        onCancel={() => { setBatchInsertOpen(false); setBatchRows([]); }}
        onOk={handleConfirmBatchInsert}
        confirmLoading={insertSaving}
        okText="确认新增"
        cancelText="取消"
        width={Math.min(columns.filter(c => !c.is_system_field).length * 160 + 100, 1200)}
        destroyOnClose
      >
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
          💡 提示：可以从 Excel 复制多行数据，直接 <Text strong>Ctrl+V 粘贴</Text> 到下方表格区域，系统会自动填充。
        </div>
        <div
          onPaste={handleBatchPaste}
          style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}
          tabIndex={0}
        >
          <Table
            size="small"
            pagination={false}
            dataSource={batchRows.map((r, i) => ({ ...r, __idx: i }))}
            rowKey="__idx"
            scroll={{ x: Math.max(columns.filter(c => !c.is_system_field).length * 150, 600) }}
            columns={[
              {
                title: '#',
                width: 50,
                fixed: 'left',
                render: (_: unknown, __: unknown, idx: number) => idx + 1,
              },
              ...columns
                .filter(c => !c.is_system_field)
                .map(col => ({
                  title: col.is_primary_key
                    ? <span>{col.field_alias} <Tag color="blue" style={{ fontSize: 10 }}>PK</Tag></span>
                    : col.field_alias,
                  dataIndex: col.field_name,
                  key: col.field_name,
                  width: 150,
                  render: (_v: string | null, record: Record<string, unknown>) => {
                    const rowIdx = record.__idx as number;
                    return (
                      <Input
                        size="small"
                        placeholder={col.is_primary_key ? '必填' : ''}
                        value={batchRows[rowIdx]?.[col.field_name] ?? ''}
                        onChange={e => handleBatchCellChange(rowIdx, col.field_name, e.target.value || null)}
                      />
                    );
                  },
                })),
            ]}
          />
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Button type="dashed" onClick={handleAddMoreRows} icon={<PlusOutlined />}>
            添加更多行（+5）
          </Button>
        </div>
      </Modal>

      {/* Diff Preview Modal (v2.1) */}
      <Modal
        title="修改预览"
        open={diffModalOpen}
        onCancel={() => setDiffModalOpen(false)}
        onOk={handleConfirmSave}
        confirmLoading={saving}
        okText="确认保存"
        cancelText="取消"
        width={700}
      >
        <p style={{ marginBottom: 12 }}>
          共 <strong>{diffData.length}</strong> 处变更，确认后将写入数据库（写前自动备份）：
        </p>
        <Table
          size="small"
          dataSource={diffData}
          rowKey={(r, i) => `${r.pk_key}_${r.field_name}_${i}`}
          pagination={false}
          scroll={{ y: 400 }}
          columns={[
            { title: '主键', dataIndex: 'pk_key', width: 120, ellipsis: true },
            { title: '字段', dataIndex: 'field_alias', width: 120 },
            {
              title: '原值',
              dataIndex: 'old_value',
              width: 180,
              render: (v: string | null) => (
                <span style={{ color: '#cf1322', background: '#fff1f0', padding: '1px 4px', borderRadius: 2 }}>
                  {v ?? <i style={{ color: '#ccc' }}>NULL</i>}
                </span>
              ),
            },
            {
              title: '新值',
              dataIndex: 'new_value',
              width: 180,
              render: (v: string | null) => (
                <span style={{ color: '#389e0d', background: '#f6ffed', padding: '1px 4px', borderRadius: 2 }}>
                  {v ?? <i style={{ color: '#ccc' }}>NULL</i>}
                </span>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
