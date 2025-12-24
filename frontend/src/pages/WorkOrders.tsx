import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

type WO = {
  id: number;
  wo_no: string;
  customer_name: string;
  due_date?: string;
  urgent: boolean;
  status: 'pending' | 'in_progress' | 'completed';
};

export default function WorkOrders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();

  const columns: ProColumns<WO>[] = [
    { title: '工單號', dataIndex: 'wo_no', copyable: true },
    { title: '客戶', dataIndex: 'customer_name' },
    { title: '交期', dataIndex: 'due_date' },
    {
      title: '狀態',
      dataIndex: 'status',
      render: (_, r) => {
        if (r.status === 'pending') return <Tag>待生產</Tag>;
        if (r.status === 'in_progress') return <Tag color="blue">生產中</Tag>;
        return <Tag color="green">已完工</Tag>;
      }
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="open" type="link" onClick={() => nav(`/work-orders/${r.id}`)}>
          查看
        </Button>,
      ],
    },
  ];

  return (
    <ProTable<WO>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="工單列表"
      request={async () => {
        const data = await api.listWorkOrders();
        return { data, success: true };
      }}
      columns={columns}
      search={false}
      pagination={{ pageSize: 20 }}
      scroll={{ x: 'max-content' }}
    />
  );
}

