import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

type Order = {
  id: number;
  order_no: string;
  customer_name: string;
  due_date?: string;
  urgent: boolean;
  status: string;
  created_at: string;
};

export default function Orders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();

  const columns: ProColumns<Order>[] = [
    { title: '訂單號', dataIndex: 'order_no', copyable: true },
    { title: '客戶', dataIndex: 'customer_name' },
    { title: '交期', dataIndex: 'due_date' },
    {
      title: '急件',
      dataIndex: 'urgent',
      render: (_, r) => (r.urgent ? <Tag color="red">急</Tag> : '-'),
      search: false,
      width: 60,
    },
    { title: '狀態', dataIndex: 'status', search: false },
    { title: '建立時間', dataIndex: 'created_at', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button
          key="to"
          type="link"
          onClick={async () => {
            try {
              await api.orderToWorkOrder(r.id);
              message.success('已轉為工單');
            } catch {
              message.error('轉工單失敗');
            } finally {
              actionRef.current?.reload();
            }
          }}
        >
          轉工單
        </Button>,
      ],
    },
  ];

  return (
    <ProTable<Order>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="訂單列表"
      toolBarRender={() => [
        <Button key="new" type="primary" onClick={() => nav('/orders/new')}>
          新增訂單
        </Button>,
      ]}
      request={async () => {
        const data = await api.listOrders();
        return { data, success: true };
      }}
      columns={columns}
      search={false}
      pagination={{ pageSize: 20 }}
    />
  );
}
