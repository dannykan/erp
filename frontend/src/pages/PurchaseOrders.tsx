import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

type PO = {
  id: number;
  po_no: string;
  supplier_name: string;
  doc_date?: string;
  created_at: string;
};

export default function PurchaseOrders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();

  const columns: ProColumns<PO>[] = [
    { title: '進貨單號', dataIndex: 'po_no', copyable: true },
    { title: '供應商', dataIndex: 'supplier_name' },
    { title: '單據日期', dataIndex: 'doc_date' },
    { title: '建立時間', dataIndex: 'created_at', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="open" type="link" onClick={() => nav(`/purchase-orders/${r.id}`)}>查看</Button>,
      ],
    },
  ];

  return (
    <ProTable<PO>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="進貨入庫（進貨單）"
      toolBarRender={() => [
        <Button key="new" type="primary" onClick={() => nav('/purchase-orders/new')}>
          建立進貨單
        </Button>,
      ]}
      request={async () => {
        const data = await api.listPOs();
        return { data, success: true };
      }}
      columns={columns}
      search={false}
      pagination={{ pageSize: 20 }}
      scroll={{ x: 'max-content' }}
    />
  );
}

