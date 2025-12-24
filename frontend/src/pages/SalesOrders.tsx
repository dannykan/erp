import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

type SO = {
  id: number;
  so_no: string;
  customer_name: string;
  doc_date?: string;
  status: string;
  created_at: string;
};

export default function SalesOrders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();

  const columns: ProColumns<SO>[] = [
    { title: '銷貨單號', dataIndex: 'so_no', copyable: true },
    { title: '客戶', dataIndex: 'customer_name' },
    { title: '單據日期', dataIndex: 'doc_date' },
    {
      title: '狀態',
      dataIndex: 'status',
      valueEnum: {
        DRAFT: { text: '待出貨', status: 'Default' },
        PICKED: { text: '已揀貨', status: 'Processing' },
        SHIPPED: { text: '已出貨', status: 'Success' },
      },
    },
    { title: '建立時間', dataIndex: 'created_at', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => {
        const actions = [
          <Button key="open" type="link" onClick={() => nav(`/sales-orders/${r.id}`)}>查看</Button>,
        ];
        // 只有 DRAFT 狀態的銷貨單可以編輯
        if (r.status === 'DRAFT') {
          actions.push(
            <Button key="edit" type="link" onClick={() => nav(`/sales-orders/${r.id}/edit`)}>編輯</Button>
          );
        }
        return actions;
      },
    },
  ];

  return (
    <ProTable<SO>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="銷貨出庫（銷貨單）"
      toolBarRender={() => [
        <Button key="new" type="primary" onClick={() => nav('/sales-orders/new')}>
          建立銷貨單
        </Button>,
      ]}
      request={async (params) => {
        const query: any = {};
        if (params.current) query.page = params.current;
        if (params.pageSize) query.page_size = params.pageSize;
        
        const response = await api.listSOs(query);
        // Backend returns { rows: [...], total: ... }
        const data = Array.isArray(response) ? response : (response.rows || []);
        const total = Array.isArray(response) ? response.length : (response.total || 0);
        return { data, success: true, total };
      }}
      columns={columns}
      search={false}
      pagination={{ pageSize: 20 }}
      scroll={{ x: 'max-content' }}
    />
  );
}

