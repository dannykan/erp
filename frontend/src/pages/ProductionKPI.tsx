import React, { useEffect, useState } from 'react';
import { Card, DatePicker, Space, Button, Table, Statistic, Row, Col, message } from 'antd';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '../app/api';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

export default function ProductionKPI() {
  const [range, setRange] = useState<[any, any]>([dayjs().startOf('month'), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<any>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await api.productionKPI({
        from_date: range[0].format('YYYY-MM-DD'),
        to_date: range[1].format('YYYY-MM-DD'),
        top_n: 10,
      });
      setKpi(data);
    } catch {
      message.error('讀取 KPI 失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rankCols = [
    { title: '項目', dataIndex: 'label' },
    { title: '數量', dataIndex: 'total_qty', width: 120 },
  ];

  return (
    <Card
      title="生產 KPI（管理用）"
      extra={
        <Space wrap>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} />
          <Button
            onClick={() => {
              const r: [any, any] = [dayjs().startOf('isoWeek'), dayjs()];
              setRange(r);
              setTimeout(load, 0);
            }}
          >
            本週
          </Button>
          <Button
            onClick={() => {
              const r: [any, any] = [dayjs().startOf('month'), dayjs()];
              setRange(r);
              setTimeout(load, 0);
            }}
          >
            本月
          </Button>
          <Button
            onClick={() => {
              const s = dayjs().subtract(1, 'month').startOf('month');
              const e = dayjs().subtract(1, 'month').endOf('month');
              const r: [any, any] = [s, e];
              setRange(r);
              setTimeout(load, 0);
            }}
          >
            上月
          </Button>
          <Button loading={loading} onClick={load}>更新</Button>
          <Button
            onClick={async () => {
              try {
                const blob = await api.exportKPIXlsx({
                  from_date: range[0].format('YYYY-MM-DD'),
                  to_date: range[1].format('YYYY-MM-DD'),
                  top_n: 10,
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `production_kpi_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                message.error('匯出失敗');
              }
            }}
          >
            匯出 Excel
          </Button>
        </Space>
      }
    >
      <Row gutter={[12, 12]}>
        {(kpi?.totals || []).map((b: any) => (
          <Col xs={24} sm={12} md={6} key={b.title}>
            <Card>
              <Statistic
                title={b.title}
                value={b.value}
                suffix={b.unit || ''}
              />
              {b.note ? <div style={{ marginTop: 6, color: '#666' }}>{b.note}</div> : null}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={8}>
          <Card title="員工產量排行（已核准）" size="small">
            <Table
              rowKey="key"
              dataSource={kpi?.employee_rank || []}
              columns={rankCols as any}
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="品項產量排行（已核准）" size="small">
            <Table
              rowKey="key"
              dataSource={kpi?.product_rank || []}
              columns={rankCols as any}
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="退回原因 Top（區間內）" size="small">
            <Table
              rowKey="key"
              dataSource={kpi?.reject_reasons || []}
              columns={[
                { title: '原因', dataIndex: 'label' },
                { title: '次數', dataIndex: 'total_qty', width: 100 },
              ] as any}
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

