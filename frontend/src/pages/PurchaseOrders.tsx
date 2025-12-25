import React, { useRef } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';

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
  const { isMobile } = useResponsive();

  const columns: ProColumns<PO>[] = [
    { title: '進貨單號', dataIndex: 'po_no', copyable: true, width: 150, fixed: 'left' },
    { title: '供應商', dataIndex: 'supplier_name', width: 150 },
    { title: '單據日期', dataIndex: 'doc_date', width: 120 },
    { title: '建立時間', dataIndex: 'created_at', search: false, width: 180 },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, r) => [
        <Button key="open" type="link" size="small" onClick={() => nav(`/purchase-orders/${r.id}`)}>查看</Button>,
      ],
    },
  ];

  return (
    <ProTable<PO>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="進貨入庫（進貨單）"
      toolBarRender={() => [
        <Button key="new" type="primary" size={isMobile ? 'small' : 'middle'} onClick={() => nav('/purchase-orders/new')}>
          建立進貨單
        </Button>,
      ]}
      request={async () => {
        const data = await api.listPOs();
        return { data, success: true };
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
      scroll={{ x: isMobile ? 600 : 800 }}
    />
  );
}

