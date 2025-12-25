import React, { useRef, useState, useEffect } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Space, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

dayjs.extend(utc);
dayjs.extend(timezone);

// 格式化日期時間為 YYYY/MM/DD HH:mm:ss（UTC+8）
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = dayjs.utc(dateStr).tz('Asia/Taipei');
  if (!date.isValid()) return dateStr;
  return date.format('YYYY/MM/DD HH:mm:ss');
}

const { RangePicker } = DatePicker;

type PR = {
  id: number;
  pr_no: string;
  report_date: string;
  status: string;
  reported_by_user_id: number;
  approved_by_user_id?: number;
  approved_at?: string;
  created_at?: string;
  items: any[];
};

export default function ProductionRecords() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const [range, setRange] = useState<[any, any]>([dayjs().startOf('month'), dayjs()]);
  const [status, setStatus] = useState<string>('APPROVED');

  useEffect(() => {
    (async () => setUserMap(await api.userIdMap()))();
  }, []);

  async function doExport() {
    try {
      const blob = await api.exportPRXlsx({
        from_date: range[0].format('YYYY-MM-DD'),
        to_date: range[1].format('YYYY-MM-DD'),
        status,
        group: 'employee',
        bucket: 'day',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('匯出失敗');
    }
  }

  const columns: ProColumns<PR>[] = [
    { title: '回報單號', dataIndex: 'pr_no', copyable: true },
    {
      title: '日期',
      dataIndex: 'report_date',
      width: 180,
      render: (_, r) => {
        // 使用 created_at 顯示回報日期+時間
        return formatDateTime(r.created_at);
      },
    },
    { title: '狀態', dataIndex: 'status', width: 90 },
    {
      title: '回報人',
      dataIndex: 'reported_by_user_id',
      search: false,
      render: (_, r) => userMap[String(r.reported_by_user_id)] || `ID ${r.reported_by_user_id}`,
    },
    { title: '項目數', search: false, render: (_, r) => r.items?.length ?? 0, width: 80 },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="open" type="link" onClick={() => nav(`/production-reports/${r.id}`)}>
          查看
        </Button>,
      ],
    },
  ];

  return (
    <ProTable<PR>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="生產紀錄查詢"
      toolBarRender={() => [
        <Space key="filters" wrap>
          <span>日期</span>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} />
          <span>狀態</span>
          <Select
            value={status}
            style={{ width: 140 }}
            onChange={setStatus}
            options={[
              { value: 'APPROVED', label: '已核准' },
              { value: 'SUBMITTED', label: '待確認' },
              { value: 'REJECTED', label: '已退回' },
              { value: 'ALL', label: '全部' },
            ]}
          />
          <Button onClick={() => actionRef.current?.reload()}>查詢</Button>
          <Button type="primary" onClick={doExport}>匯出 Excel</Button>
        </Space>,
      ]}
      request={async () => {
        // 這裡直接用 listPRs，後端目前 listPRs 沒有 from/to 參數
        // MVP：先用 status 篩，日期篩選先在前端過濾（資料量小 OK）
        const data = await api.listPRs(status === 'ALL' ? {} : { status });
        const f = range[0].format('YYYY-MM-DD');
        const t = range[1].format('YYYY-MM-DD');
        const filtered = (data || []).filter((x: any) => x.report_date >= f && x.report_date <= t);
        return { data: filtered, success: true };
      }}
      columns={columns}
      search={false}
      pagination={{ pageSize: 20 }}
    />
  );
}

