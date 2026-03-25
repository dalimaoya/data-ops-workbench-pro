import { useState, useEffect, useMemo } from 'react';
import { Table, Tag, Space, Typography, Button, Collapse, Result, Alert, message, Spin, Tooltip, Badge } from 'antd';
import {
  CheckCircleOutlined, ReloadOutlined, ExportOutlined,
  WarningOutlined, CloseCircleOutlined, RobotOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiDataValidate } from '../../api/aiValidate';
import type { AIValidationIssue, AIValidateStats } from '../../api/aiValidate';
import type { ParsedTable } from './SmartImportPage';

const { Text } = Typography;

const CHECK_TYPE_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  outlier: { zh: '异常值', en: 'Outlier', color: 'orange' },
  format: { zh: '格式不一致', en: 'Format', color: 'blue' },
  duplicate: { zh: '重复值', en: 'Duplicate', color: 'purple' },
  cross_field: { zh: '跨字段逻辑', en: 'Cross-field', color: 'red' },
  ai_insight: { zh: 'AI 洞察', en: 'AI Insight', color: 'cyan' },
};

interface Props {
  selectedTables: ParsedTable[];
  onReset: () => void;
}

/** Build a lookup: `${row}-${field_name}` → issue */
function buildIssueLookup(issues: AIValidationIssue[]) {
  const map = new Map<string, AIValidationIssue[]>();
  for (const issue of issues) {
    if (!issue.field_name || issue.row === 0) continue;
    const key = `${issue.row}-${issue.field_name}`;
    const arr = map.get(key) || [];
    arr.push(issue);
    map.set(key, arr);
  }
  return map;
}

export default function StepPreview({ selectedTables, onReset }: Props) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [submitted, setSubmitted] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Map<number, { issues: AIValidationIssue[]; stats: AIValidateStats; hasErrors: boolean }>
  >(new Map());

  const readyTables = selectedTables.filter(
    t => t.matchedTableId && t.fieldMappings && t.fieldMappings.some(m => m.target_field)
  );

  // Run AI validation on mount
  useEffect(() => {
    if (readyTables.length === 0) return;
    runValidation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runValidation = async () => {
    setValidating(true);
    const results = new Map<number, { issues: AIValidationIssue[]; stats: AIValidateStats; hasErrors: boolean }>();

    for (const tbl of readyTables) {
      if (!tbl.matchedTableId) continue;
      const activeMappings = (tbl.fieldMappings || []).filter((m: any) => m.target_field);
      if (activeMappings.length === 0) continue;

      // Build import_data from preview rows
      const importData = (tbl.preview_rows || []).map((row: any[], rowIdx: number) => {
        const obj: Record<string, any> = { _row_num: rowIdx + 2 };
        activeMappings.forEach((m: any) => {
          const srcIdx = tbl.headers.indexOf(m.source_column);
          obj[m.target_field] = srcIdx >= 0 ? (row[srcIdx] || '') : '';
        });
        return obj;
      });

      try {
        const resp = await aiDataValidate({
          table_id: tbl.matchedTableId,
          import_data: importData,
        });
        if (resp.data?.success && resp.data.data) {
          results.set(tbl.table_index, {
            issues: resp.data.data.warnings || [],
            stats: resp.data.data.stats,
            hasErrors: resp.data.data.has_errors || false,
          });
        }
      } catch {
        // AI validation failure is non-blocking
      }
    }
    setValidationResults(results);
    setValidating(false);
  };

  // Aggregate stats
  const totalStats = useMemo(() => {
    let warnings = 0, errors = 0;
    validationResults.forEach(v => {
      errors += v.stats?.error_count || 0;
      warnings += v.stats?.warning_count || 0;
    });
    return { warnings, errors };
  }, [validationResults]);

  const anyBlockingError = useMemo(() => {
    let has = false;
    validationResults.forEach(v => { if (v.hasErrors) has = true; });
    return has;
  }, [validationResults]);

  const handleSubmit = () => {
    if (anyBlockingError) {
      message.error(isZh ? '存在阻断性错误，请修正后再提交' : 'Blocking errors exist, please fix before submitting');
      return;
    }
    message.success(t('smartImport.submitSuccess'));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Result
        status="success"
        title={t('smartImport.importComplete')}
        subTitle={t('smartImport.importCompleteDesc', { count: readyTables.length })}
        extra={[
          <Button key="new" type="primary" icon={<ReloadOutlined />} onClick={onReset}>
            {t('smartImport.newImport')}
          </Button>,
        ]}
      />
    );
  }

  if (readyTables.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        message={t('smartImport.noReadyTables')}
        description={t('smartImport.goBackToMap')}
      />
    );
  }

  const collapseItems = readyTables.map(tbl => {
    const mappings = tbl.fieldMappings || [];
    const activeMappings = mappings.filter((m: any) => m.target_field);
    const result = validationResults.get(tbl.table_index);
    const issueLookup = result ? buildIssueLookup(result.issues) : new Map();
    const globalIssues = result ? result.issues.filter(i => i.row === 0) : [];

    // Build preview data with row numbers
    const previewData = (tbl.preview_rows || []).map((row: any[], i: number) => {
      const obj: Record<string, string> = { _key: String(i), _row_num: String(i + 2) };
      activeMappings.forEach((m: any) => {
        const srcIdx = tbl.headers.indexOf(m.source_column);
        obj[m.target_field] = srcIdx >= 0 ? (row[srcIdx] || '') : '';
      });
      return obj;
    });

    // Build columns with cell-level highlighting
    const previewColumns = activeMappings.map((m: any) => ({
      title: (
        <div>
          <div>{m.target_alias || m.target_field}</div>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>← {m.source_column}</div>
        </div>
      ),
      dataIndex: m.target_field,
      key: m.target_field,
      ellipsis: true,
      render: (text: string, record: any) => {
        const rowNum = parseInt(record._row_num);
        const cellKey = `${rowNum}-${m.target_field}`;
        const cellIssues = issueLookup.get(cellKey);

        if (!cellIssues || cellIssues.length === 0) {
          return text || '-';
        }

        const maxSeverity = cellIssues.some(i => i.severity === 'error') ? 'error' : 'warning';
        const bgColor = maxSeverity === 'error' ? '#fff2f0' : '#fffbe6';
        const borderColor = maxSeverity === 'error' ? '#ffccc7' : '#ffe58f';

        const tooltipContent = (
          <div>
            {cellIssues.map((issue, idx) => {
              const typeInfo = CHECK_TYPE_LABELS[issue.check_type] || { zh: issue.check_type, en: issue.check_type, color: 'default' };
              return (
                <div key={idx} style={{ marginBottom: idx < cellIssues.length - 1 ? 8 : 0 }}>
                  <Tag color={typeInfo.color} style={{ fontSize: 11 }}>
                    {issue.severity === 'error' ? '⛔' : '⚠️'} {isZh ? typeInfo.zh : typeInfo.en}
                  </Tag>
                  <div style={{ marginTop: 2 }}>{issue.message}</div>
                  {issue.detail && (
                    <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>{issue.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        );

        return (
          <Tooltip title={tooltipContent} overlayStyle={{ maxWidth: 400 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: 4,
                background: bgColor,
                border: `1px solid ${borderColor}`,
                cursor: 'help',
              }}
            >
              {maxSeverity === 'error' ? (
                <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
              ) : (
                <WarningOutlined style={{ color: '#faad14', marginRight: 4 }} />
              )}
              {text || '-'}
            </span>
          </Tooltip>
        );
      },
    }));

    const tblErrorCount = result?.stats?.error_count || 0;
    const tblWarnCount = result?.stats?.warning_count || 0;

    return {
      key: String(tbl.table_index),
      label: (
        <Space>
          <CheckCircleOutlined style={{ color: tblErrorCount > 0 ? '#ff4d4f' : '#52c41a' }} />
          <Text strong>{tbl.title_guess || `#${tbl.table_index + 1}`}</Text>
          <Text type="secondary">→</Text>
          <Text>{tbl.matchedTableAlias || tbl.matchedTableName}</Text>
          <Tag color="blue">
            {activeMappings.length} {t('smartImport.fieldsMapped')}
          </Tag>
          <Tag>
            {tbl.row_count} {t('smartImport.rows')}
          </Tag>
          {tblErrorCount > 0 && (
            <Tag color="error" icon={<CloseCircleOutlined />}>{tblErrorCount} {isZh ? '错误' : 'errors'}</Tag>
          )}
          {tblWarnCount > 0 && (
            <Tag color="warning" icon={<WarningOutlined />}>{tblWarnCount} {isZh ? '警告' : 'warnings'}</Tag>
          )}
        </Space>
      ),
      children: (
        <div>
          {/* Global-level issues (row=0) */}
          {globalIssues.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {globalIssues.map((issue, idx) => {
                const typeInfo = CHECK_TYPE_LABELS[issue.check_type] || { zh: issue.check_type, en: issue.check_type, color: 'default' };
                return (
                  <Alert
                    key={idx}
                    type={issue.severity === 'error' ? 'error' : 'warning'}
                    showIcon
                    icon={issue.check_type === 'ai_insight' ? <RobotOutlined /> : undefined}
                    message={
                      <Space>
                        <Tag color={typeInfo.color}>{isZh ? typeInfo.zh : typeInfo.en}</Tag>
                        {issue.column && <Text type="secondary">{issue.column}</Text>}
                      </Space>
                    }
                    description={issue.message}
                    style={{ marginBottom: 8 }}
                  />
                );
              })}
            </div>
          )}
          <Table
            dataSource={previewData}
            columns={previewColumns}
            rowKey="_key"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      ),
    };
  });

  return (
    <div>
      {/* Summary stats bar */}
      {validating ? (
        <Alert
          type="info"
          showIcon
          icon={<Spin size="small" />}
          message={isZh ? 'AI 智能校验中…' : 'Running AI smart validation…'}
          style={{ marginBottom: 16 }}
        />
      ) : validationResults.size > 0 ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Alert
            type="info"
            showIcon
            message={t('smartImport.previewInfo', { count: readyTables.length })}
            style={{ flex: 1 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={totalStats.errors} showZero overflowCount={999}
              style={{ backgroundColor: totalStats.errors > 0 ? '#ff4d4f' : '#d9d9d9' }}>
              <Tag color={totalStats.errors > 0 ? 'error' : 'default'} style={{ margin: 0, padding: '4px 12px' }}>
                <CloseCircleOutlined style={{ marginRight: 4 }} />
                {isZh ? '错误' : 'Errors'}
              </Tag>
            </Badge>
            <Badge count={totalStats.warnings} showZero overflowCount={999}
              style={{ backgroundColor: totalStats.warnings > 0 ? '#faad14' : '#d9d9d9' }}>
              <Tag color={totalStats.warnings > 0 ? 'warning' : 'default'} style={{ margin: 0, padding: '4px 12px' }}>
                <WarningOutlined style={{ marginRight: 4 }} />
                {isZh ? '警告' : 'Warnings'}
              </Tag>
            </Badge>
            <Button size="small" icon={<ReloadOutlined />} onClick={runValidation}>
              {isZh ? '重新校验' : 'Re-validate'}
            </Button>
          </div>
        </div>
      ) : (
        <Alert
          type="info"
          showIcon
          message={t('smartImport.previewInfo', { count: readyTables.length })}
          style={{ marginBottom: 16 }}
        />
      )}

      {anyBlockingError && (
        <Alert
          type="error"
          showIcon
          message={isZh ? '存在阻断性错误' : 'Blocking errors detected'}
          description={isZh
            ? '请修正标红的数据后再提交导入。错误级别的问题将阻止导入操作。'
            : 'Please fix the red-highlighted data before submitting. Error-level issues will block the import.'}
          style={{ marginBottom: 16 }}
        />
      )}

      <Collapse
        defaultActiveKey={readyTables.map(t => String(t.table_index))}
        items={collapseItems}
      />

      <div style={{ marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={isZh
            ? 'AI 智能校验基于历史数据统计分析，警告仅为参考提示，不阻断导入。可在「AI 配置」中调整。'
            : 'AI smart validation is based on historical data statistics. Warnings are advisory and do not block import.'}
          style={{ marginBottom: 16 }}
        />
      </div>

      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <Space size="large">
          <Button
            size="large"
            icon={<ExportOutlined />}
            type="primary"
            onClick={handleSubmit}
            loading={validating}
            disabled={anyBlockingError}
          >
            {t('smartImport.confirmImport')}
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">{t('smartImport.confirmHint')}</Text>
        </div>
      </div>
    </div>
  );
}
