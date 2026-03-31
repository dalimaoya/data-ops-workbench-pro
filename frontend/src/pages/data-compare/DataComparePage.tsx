import { useState, useEffect } from 'react';
import { Card, Select, Button, Table, message, Space, Statistic, Row, Col, Tag, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/request';
import { listDatasources, getDatasourceDatabases } from '../../api/datasource';
import { getRemoteTables } from '../../api/tableConfig';
import { buildDatasourceOptions } from '../../utils/datasourceOptions';
import { useDatasourceOnline } from '../../context/DatasourceOnlineContext';
import type { Datasource } from '../../api/datasource';

export default function DataComparePage() {
  const { t } = useTranslation();
  const { onlineStatus } = useDatasourceOnline();
  const [datasources, setDatasources] = useState<Datasource[]>([]);

  // Source side
  const [srcDs, setSrcDs] = useState<number | null>(null);
  const [srcDbs, setSrcDbs] = useState<string[]>([]);
  const [srcDb, setSrcDb] = useState<string | undefined>();
  const [srcTables, setSrcTables] = useState<string[]>([]);
  const [srcTable, setSrcTable] = useState<string | undefined>();
  const [srcLoading, setSrcLoading] = useState(false);

  // Target side
  const [tgtDs, setTgtDs] = useState<number | null>(null);
  const [tgtDbs, setTgtDbs] = useState<string[]>([]);
  const [tgtDb, setTgtDb] = useState<string | undefined>();
  const [tgtTables, setTgtTables] = useState<string[]>([]);
  const [tgtTable, setTgtTable] = useState<string | undefined>();
  const [tgtLoading, setTgtLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    listDatasources({ page_size: 100 }).then(res => {
      setDatasources(Array.isArray(res.data) ? res.data : (res.data as any).items || []);
    }).catch(() => {});
  }, []);

  // Source DS change — only fetch databases, don't fetch tables until DB selected
  const handleSrcDsChange = (v: number | null) => {
    setSrcDs(v);
    setSrcDb(undefined);
    setSrcDbs([]);
    setSrcTable(undefined);
    setSrcTables([]);
    if (v) {
      setSrcLoading(true);
      getDatasourceDatabases(v).then(res => setSrcDbs(res.data.databases || [])).catch(() => {}).finally(() => setSrcLoading(false));
    }
  };

  // Source DB change — fetch tables for selected database
  const handleSrcDbChange = (v: string | undefined) => {
    setSrcDb(v);
    setSrcTable(undefined);
    setSrcTables([]);
    if (srcDs && v) {
      setSrcLoading(true);
      getRemoteTables(srcDs, { db_name: v }).then(res => {
        setSrcTables(res.data.tables.map((t: any) => t.table_name));
      }).catch(() => setSrcTables([])).finally(() => setSrcLoading(false));
    }
  };

  // Target DS change
  const handleTgtDsChange = (v: number | null) => {
    setTgtDs(v);
    setTgtDb(undefined);
    setTgtDbs([]);
    setTgtTable(undefined);
    setTgtTables([]);
    if (v) {
      setTgtLoading(true);
      getDatasourceDatabases(v).then(res => setTgtDbs(res.data.databases || [])).catch(() => {}).finally(() => setTgtLoading(false));
    }
  };

  // Target DB change
  const handleTgtDbChange = (v: string | undefined) => {
    setTgtDb(v);
    setTgtTable(undefined);
    setTgtTables([]);
    if (tgtDs && v) {
      setTgtLoading(true);
      getRemoteTables(tgtDs, { db_name: v }).then(res => {
        setTgtTables(res.data.tables.map((t: any) => t.table_name));
      }).catch(() => setTgtTables([])).finally(() => setTgtLoading(false));
    }
  };

  const handleCompare = async () => {
    if (!srcDs || !srcTable || !tgtDs || !tgtTable) {
      message.warning(t('dataCompare.fillAll'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/data-compare/run', {
        source_ds_id: srcDs,
        source_db_name: srcDb,
        source_table: srcTable,
        target_ds_id: tgtDs,
        target_db_name: tgtDb,
        target_table: tgtTable,
      });
      setResult(res.data.result);
      message.success(t('dataCompare.compareSuccess'));
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('dataCompare.compareFailed'));
    } finally {
      setLoading(false);
    }
  };

  const dsOptions = buildDatasourceOptions(datasources, onlineStatus);

  const diffColumns = [
    { title: 'Key', dataIndex: 'key', key: 'key', render: (v: any) => v?.join(', ') },
    { title: t('dataCompare.diffFields'), dataIndex: 'diffs', key: 'diffs', render: (diffs: any) => (
      <Space direction="vertical" size={0}>
        {Object.entries(diffs || {}).map(([field, vals]: any) => (
          <div key={field}><Tag>{field}</Tag> {vals.source} → {vals.target}</div>
        ))}
      </Space>
    )},
  ];

  const renderSide = (
    label: string,
    ds: number | null, _setDs: (v: number | null) => void, handleDsChange: (v: number | null) => void,
    dbs: string[], db: string | undefined, handleDbChange: (v: string | undefined) => void,
    tables: string[], table: string | undefined, setTable: (v: string | undefined) => void,
    sideLoading: boolean,
  ) => (
    <Card title={label} size="small" style={{ height: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>{t('dataCompare.datasource')}</div>
          <Select style={{ width: '100%' }} value={ds} onChange={handleDsChange} placeholder={t('maintenance.selectDatasource')} options={dsOptions} allowClear />
        </div>
        {ds && dbs.length > 0 && (
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>{t('tableConfig.selectDatabase')}</div>
            <Select style={{ width: '100%' }} value={db} onChange={handleDbChange} placeholder={t('tableConfig.selectDatabase')} allowClear showSearch options={dbs.map(d => ({ label: d, value: d }))} />
          </div>
        )}
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>{t('dataCompare.tableName')}</div>
          <Spin spinning={sideLoading} size="small">
            <Select style={{ width: '100%' }} value={table} onChange={setTable} placeholder={t('dataCompare.selectTable')} allowClear showSearch disabled={!ds || sideLoading} options={tables.map(t => ({ label: t, value: t }))} />
          </Spin>
        </div>
      </Space>
    </Card>
  );

  return (
    <div>
      <Card title={t('dataCompare.title')}>
        <Row gutter={16}>
          <Col span={11}>
            {renderSide(
              t('dataCompare.sourceDs'), srcDs, setSrcDs, handleSrcDsChange,
              srcDbs, srcDb, handleSrcDbChange,
              srcTables, srcTable, setSrcTable, srcLoading,
            )}
          </Col>
          <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, color: '#999' }}>⇄</span>
          </Col>
          <Col span={11}>
            {renderSide(
              t('dataCompare.targetDs'), tgtDs, setTgtDs, handleTgtDsChange,
              tgtDbs, tgtDb, handleTgtDbChange,
              tgtTables, tgtTable, setTgtTable, tgtLoading,
            )}
          </Col>
        </Row>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button type="primary" size="large" onClick={handleCompare} loading={loading} disabled={!srcDs || !srcTable || !tgtDs || !tgtTable}>
            {t('dataCompare.runCompare')}
          </Button>
        </div>
      </Card>

      {result && (
        <Card style={{ marginTop: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}><Statistic title={t('dataCompare.sourceRows')} value={result.source_row_count} /></Col>
            <Col span={4}><Statistic title={t('dataCompare.targetRows')} value={result.target_row_count} /></Col>
            <Col span={4}><Statistic title={t('dataCompare.onlyInSource')} value={result.only_in_source_count} valueStyle={{ color: '#cf1322' }} /></Col>
            <Col span={4}><Statistic title={t('dataCompare.onlyInTarget')} value={result.only_in_target_count} valueStyle={{ color: '#faad14' }} /></Col>
            <Col span={4}><Statistic title={t('dataCompare.different')} value={result.different_count} valueStyle={{ color: '#1890ff' }} /></Col>
            <Col span={4}>
              <div style={{ fontSize: 12, color: '#999' }}>{t('dataCompare.matchedFields')}</div>
              <div>{result.matched_fields?.join(', ')}</div>
            </Col>
          </Row>

          {result.different?.length > 0 && (
            <>
              <h4>{t('dataCompare.different')} ({t('dataCompare.first100')})</h4>
              <Table columns={diffColumns} dataSource={result.different} rowKey={(r: any) => r.key?.join('-')}
                size="small" pagination={{ pageSize: 20 }} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
