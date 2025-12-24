import React, { useMemo, useState, useEffect } from 'react';
import { Card, DatePicker, Select, Space, Tabs, Button, Table, message } from 'antd';
import dayjs from 'dayjs';
import { api } from '../app/api';

const { RangePicker } = DatePicker;

type Row = { bucket: string; key: string; label: string; total_qty: number };

export default function ProductionDashboard() {
  const [range, setRange] = useState<[any, any]>([dayjs().startOf('month'), dayjs()]);
  const [bucket, setBucket] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [status, setStatus] = useState<'APPROVED' | 'ALL'>('APPROVED');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const [tab, setTab] = useState<'employee' | 'product' | 'product_spec'>('employee');
  const [data, setData] = useState<Row[]>([]);
  const params = useMemo(() => ({
    from_date: range[0].format('YYYY-MM-DD'),
    to_date: range[1].format('YYYY-MM-DD'),
    bucket,
    status,
  }), [range, bucket, status]);

  useEffect(() => {
    (async () => setUserMap(await api.userIdMap()))();
  }, []);

  async function load() {
    try {
      if (tab === 'employee') setData(await api.summaryByEmployee(params));
      else if (tab === 'product') setData(await api.summaryByProduct(params));
      else setData(await api.summaryByProductSpec(params));
    } catch {
      message.error('讀取報表失敗');
    }
  }

  useEffect(() => {
    load();
  }, [tab, params]);

  async function exportXlsx() {
    try {
      const blob = await api.exportPRXlsx({
        ...params,
        group: tab,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production_summary_${tab}_${params.from_date}_${params.to_date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('匯出失敗');
    }
  }

  const columns = [
    { title: 'Bucket', dataIndex: 'bucket', width: 120 },
    { title: 'Label', dataIndex: 'label' },
    { title: 'Total', dataIndex: 'total_qty', width: 120 },
  ];

  const shown = data.map(r => {
    if (r.key.startsWith('employee:')) {
      const id = r.key.split(':')[1];
      return { ...r, label: userMap[id] || `員工ID ${id}` };
    }
    return r;
  });

  return (
    <Card title="生產報表（統計）" extra={
      <Space wrap>
        <span>日期</span>
        <RangePicker value={range} onChange={(v) => v && setRange(v as any)} />
        <span>彙總</span>
        <Select
          value={bucket}
          style={{ width: 120 }}
          onChange={(v) => setBucket(v)}
          options={[
            { value: 'day', label: '日' },
            { value: 'week', label: '週' },
            { value: 'month', label: '月' },
            { value: 'year', label: '年' },
          ]}
        />
        <span>狀態</span>
        <Select
          value={status}
          style={{ width: 160 }}
          onChange={(v) => setStatus(v)}
          options={[
            { value: 'APPROVED', label: '只算已核准' },
            { value: 'ALL', label: '全部（含待確認/退回）' },
          ]}
        />
        <Button onClick={load}>更新</Button>
        <Button type="primary" onClick={exportXlsx}>匯出 Excel</Button>
      </Space>
    }>
      <Tabs
        activeKey={tab}
        onChange={(k) => { setTab(k as any); }}
        items={[
          { key: 'employee', label: '依員工', children: <Table rowKey={(r) => r.bucket + r.key} dataSource={shown} columns={columns as any} pagination={{ pageSize: 20 }} /> },
          { key: 'product', label: '依品項', children: <Table rowKey={(r) => r.bucket + r.key} dataSource={data} columns={columns as any} pagination={{ pageSize: 20 }} /> },
          { key: 'product_spec', label: '依規格', children: <Table rowKey={(r) => r.bucket + r.key} dataSource={data} columns={columns as any} pagination={{ pageSize: 20 }} /> },
        ]}
      />
    </Card>
  );
}

