import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';

type SO = {
  id: number;
  so_no: string;
  customer_name: string;
  doc_date?: string;
  status: string;
  is_paid?: boolean;
  paid_at?: string;
  created_at: string;
};

export default function SalesOrders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const { isMobile } = useResponsive();

  const columns: ProColumns<SO>[] = [
    { title: '銷貨單號', dataIndex: 'so_no', copyable: true, width: 150, fixed: 'left' },
    { title: '客戶', dataIndex: 'customer_name', width: 150 },
    { title: '單據日期', dataIndex: 'doc_date', width: 120 },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        DRAFT: { text: '待出貨', status: 'Default' },
        PICKED: { text: '已揀貨', status: 'Processing' },
        SHIPPED: { text: '已出貨', status: 'Success' },
      },
    },
    {
      title: '付款狀態',
      dataIndex: 'is_paid',
      search: false,
      width: 100,
      render: (_, r) => {
        if (r.status === 'SHIPPED') {
          return r.is_paid ? (
            <Tag color="green">已付款</Tag>
          ) : (
            <Tag color="orange">未付款</Tag>
          );
        }
        return '-';
      },
    },
    { title: '建立時間', dataIndex: 'created_at', search: false, width: 180 },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, r) => {
        const actions = [
          <Button key="open" type="link" size="small" onClick={() => nav(`/sales-orders/${r.id}`)}>查看</Button>,
        ];
        // 只有 DRAFT 狀態的銷貨單可以編輯
        if (r.status === 'DRAFT') {
          actions.push(
            <Button key="edit" type="link" size="small" onClick={() => nav(`/sales-orders/${r.id}/edit`)}>編輯</Button>
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
        <Button key="new" type="primary" size={isMobile ? 'small' : 'middle'} onClick={() => nav('/sales-orders/new')}>
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
      pagination={{ 
        pageSize: 20,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        showTotal: (total) => `共 ${total} 條`,
        simple: isMobile,
        size: isMobile ? 'small' : 'default',
      }}
      scroll={{ x: isMobile ? 800 : 1000 }}
    />
  );
}

