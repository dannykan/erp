import React, { useRef, useState, useEffect } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Space, Modal, Input, message } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// 格式化日期時間為 YYYY/MM/DD HH:mm:ss（UTC+8）
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = dayjs.utc(dateStr).tz('Asia/Taipei');
  if (!date.isValid()) return dateStr;
  return date.format('YYYY/MM/DD HH:mm:ss');
}

type PR = {
  id: number;
  pr_no: string;
  report_date: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  note?: string;
  created_at: string;
  reported_by_user_id: number;
  items: any[];
};

export default function ProductionApproval() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectId, setRejectId] = useState<number | null>(null);

  useEffect(() => {
    (async () => setUserMap(await api.userIdMap()))();
  }, []);

  const columns: ProColumns<PR>[] = [
    { title: '回報單號', dataIndex: 'pr_no', copyable: true },
    {
      title: '回報日期',
      dataIndex: 'created_at',
      search: false,
      render: (_, r) => formatDateTime(r.created_at),
    },
    {
      title: '回報人',
      dataIndex: 'reported_by_user_id',
      search: false,
      render: (_, r) => userMap[String(r.reported_by_user_id)] || `ID ${r.reported_by_user_id}`,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      valueEnum: {
        SUBMITTED: { text: '待確認' },
        APPROVED: { text: '已核准' },
        REJECTED: { text: '已退回' },
      },
      render: (_, r) => {
        const map: any = {
          SUBMITTED: <Tag color="gold">待確認</Tag>,
          APPROVED: <Tag color="green">已核准</Tag>,
          REJECTED: <Tag color="red">已退回</Tag>,
        };
        return map[r.status] || r.status;
      },
      width: 100,
    },
    { title: '項目數', search: false, render: (_, r) => r.items?.length ?? 0, width: 90 },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      search: false,
      render: (_, r) => formatDateTime(r.created_at),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => {
        const isPending = r.status === 'SUBMITTED';
        return [
          <Button key="open" type="link" onClick={() => nav(`/production-reports/${r.id}`)}>
            查看
          </Button>,
          isPending ? (
            <Button
              key="approve"
              type="link"
              onClick={async () => {
                try {
                  await api.approvePR(r.id);
                  message.success('已核准並入倉庫庫存');
                  actionRef.current?.reload();
                } catch (e: any) {
                  console.error('Approve PR error:', e);
                  const errorMsg = e?.message || '核准失敗';
                  message.error(`核准失敗：${errorMsg}`);
                }
              }}
            >
              核准
            </Button>
          ) : null,
          isPending ? (
            <Button
              key="reject"
              type="link"
              danger
              onClick={() => {
                setRejectId(r.id);
                setRejectReason('');
                setRejectOpen(true);
              }}
            >
              退回
            </Button>
          ) : null,
        ];
      },
    },
  ];

  return (
    <>
      <ProTable<PR>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="待確認生產回報（廠長）"
        toolBarRender={() => [
          <Space key="tools">
            <Button onClick={() => actionRef.current?.reload()}>刷新</Button>
          </Space>,
        ]}
        request={async () => {
          // 只看待確認
          const data = await api.listPRs({ status: 'SUBMITTED' });
          return { data, success: true };
        }}
        columns={columns}
        search={false}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="退回原因"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (!rejectId) return;
          try {
            await api.rejectPR(rejectId, rejectReason);
            message.success('已退回');
            setRejectOpen(false);
            actionRef.current?.reload();
          } catch {
            message.error('退回失敗');
          }
        }}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="請輸入退回原因（可留空）"
        />
      </Modal>
    </>
  );
}

