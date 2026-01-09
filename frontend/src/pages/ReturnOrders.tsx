import React, { useRef, useState } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../app/api';
import { useResponsive } from '../hooks/useResponsive';

type ReturnOrder = {
  id: number;
  return_no: string;
  customer_name: string;
  source_so_id: number;
  doc_date?: string;
  status: string;
  is_stocked: boolean;
  created_at: string;
};

export default function ReturnOrders() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const { isMobile } = useResponsive();

  const columns: ProColumns<ReturnOrder>[] = [
    {
      title: '退貨單號',
      dataIndex: 'return_no',
      copyable: true,
      width: 150,
      fixed: 'left',
    },
    {
      title: '客戶名稱',
      dataIndex: 'customer_name',
      width: 150,
    },
    {
      title: '日期',
      dataIndex: 'doc_date',
      width: 120,
      render: (_, record) => record.doc_date || '-',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          pending: { text: '待確認', color: 'orange' },
          confirmed: { text: '已確認', color: 'blue' },
          stocked: { text: '已入倉', color: 'green' },
        };
        const status = statusMap[record.status] || { text: record.status, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '是否入倉',
      dataIndex: 'is_stocked',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_stocked ? 'green' : 'default'}>
          {record.is_stocked ? '已入倉' : '未入倉'}
        </Tag>
      ),
    },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      width: 180,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="view"
          type="link"
          size="small"
          onClick={() => nav(`/return-orders/${record.id}`)}
        >
          查看
        </Button>,
        !record.is_stocked && record.status === 'confirmed' && (
          <Button
            key="stock"
            type="link"
            size="small"
            onClick={async () => {
              try {
                await api.stockReturnOrder(record.id);
                message.success('已入倉');
                actionRef.current?.reload();
              } catch (err: any) {
                message.error('入倉失敗：' + (err.message || '未知錯誤'));
              }
            }}
          >
            入倉
          </Button>
        ),
      ],
    },
  ];

  return (
    <ProTable<ReturnOrder>
      actionRef={actionRef}
      rowKey="id"
      headerTitle="退換貨"
      toolBarRender={() => [
        <Button
          key="new"
          type="primary"
          size={isMobile ? 'small' : 'middle'}
          onClick={() => nav('/return-orders/new')}
        >
          建立退貨單
        </Button>,
      ]}
      request={async (params) => {
        const data = await api.listReturnOrders({
          customer_name: params.customer_name,
          status: params.status,
        });
        return { data, success: true };
      }}
      columns={columns}
      search={{
        labelWidth: 'auto',
        defaultCollapsed: true,
      }}
      pagination={{
        pageSize: 20,
        showSizeChanger: !isMobile,
      }}
      scroll={{ x: 'max-content' }}
    />
  );
}



