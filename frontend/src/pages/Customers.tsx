import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSwitch, ProFormDatePicker } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import { api } from '../app/api';

type Customer = {
  id: number;
  name: string;
  customer_code?: string;
  short_name?: string;
  full_name?: string;
  tax_id?: string;
  contact?: string;
  phone?: string;
  address?: string;
  invoice_title?: string;
  sales_category?: string;
  filing_date?: string;
  email?: string;
  note?: string;
  is_active: boolean;
  created_at: string;
};

export default function Customers() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const columns: ProColumns<Customer>[] = [
    { 
      title: '客戶代號', 
      dataIndex: 'customer_code', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.customer_code || '';
        const bVal = b.customer_code || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '簡稱', 
      dataIndex: 'short_name', 
      width: 120,
      sorter: (a, b) => {
        const aVal = a.short_name || '';
        const bVal = b.short_name || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '長名稱', 
      dataIndex: 'full_name', 
      width: 200,
      sorter: (a, b) => {
        const aVal = a.full_name || '';
        const bVal = b.full_name || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '統編', 
      dataIndex: 'tax_id', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.tax_id || '';
        const bVal = b.tax_id || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '聯絡窗口', 
      dataIndex: 'contact', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.contact || '';
        const bVal = b.contact || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '電話', 
      dataIndex: 'phone', 
      width: 150,
      sorter: (a, b) => {
        const aVal = a.phone || '';
        const bVal = b.phone || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '送貨地址', 
      dataIndex: 'address', 
      ellipsis: true, 
      width: 200,
      sorter: (a, b) => {
        const aVal = a.address || '';
        const bVal = b.address || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '發票抬頭', 
      dataIndex: 'invoice_title', 
      width: 150,
      sorter: (a, b) => {
        const aVal = a.invoice_title || '';
        const bVal = b.invoice_title || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '銷貨類別', 
      dataIndex: 'sales_category', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.sales_category || '';
        const bVal = b.sales_category || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '建檔日期', 
      dataIndex: 'filing_date', 
      width: 120,
      sorter: (a, b) => {
        const aVal = a.filing_date || '';
        const bVal = b.filing_date || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: 'E-mail', 
      dataIndex: 'email', 
      width: 150,
      sorter: (a, b) => {
        const aVal = a.email || '';
        const bVal = b.email || '';
        return aVal.localeCompare(bVal);
      },
    },
    {
      title: '狀態',
      dataIndex: 'is_active',
      width: 90,
      sorter: (a, b) => {
        if (a.is_active === b.is_active) return 0;
        return a.is_active ? 1 : -1;
      },
      render: (_, r) => r.is_active ? <Tag color="green">啟用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="edit" type="link" onClick={() => { setEditing(r); setOpen(true); }}>
          編輯
        </Button>,
      ],
    },
  ];

  return (
    <>
      <ProTable<Customer>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="客戶管理"
        toolBarRender={() => [
          <Button key="new" type="primary" onClick={() => { setEditing(null); setOpen(true); }}>
            新增客戶
          </Button>,
        ]}
        request={async (params) => {
          const q = (params.keyword as string) || undefined;
          const data = await api.listCustomers({ q });
          return { data, success: true };
        }}
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
      />

      <ModalForm
        key={editing?.id || 'new'}
        title={editing ? '編輯客戶' : '新增客戶'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing || { is_active: true }}
        onFinish={async (v) => {
          try {
            if (editing) await api.updateCustomer(editing.id, v);
            else await api.createCustomer(v);
            message.success('已儲存');
            setOpen(false);
            actionRef.current?.reload();
            return true;
          } catch {
            message.error('儲存失敗（客戶名稱可能重複）');
            return false;
          }
        }}
      >
        <ProFormText name="customer_code" label="客戶代號（可空）" placeholder="例如: 22000" />
        <ProFormText name="short_name" label="簡稱（可空）" placeholder="例如: 大燈籠" />
        <ProFormText name="full_name" label="長名稱（可空）" placeholder="例如: 22000 大燈籠" />
        <ProFormText name="name" label="客戶名稱" rules={[{ required: true }]} tooltip="系統唯一識別，通常使用簡稱或長名稱" />
        <ProFormText name="tax_id" label="統編（可空）" placeholder="例如: 30366201" />
        <ProFormText name="contact" label="聯絡窗口（可空）" placeholder="例如: 劉炳宏" />
        <ProFormText name="phone" label="電話（可空）" placeholder="例如: (02)2226-1795" />
        <ProFormText name="address" label="送貨地址（可空）" placeholder="例如: 新北市中和區..." />
        <ProFormText name="invoice_title" label="發票抬頭（可空）" placeholder="例如: 大燈籠商行" />
        <ProFormText name="sales_category" label="銷貨類別（可空）" placeholder="例如: 現金、月結" />
        <ProFormDatePicker name="filing_date" label="建檔日期（可空）" />
        <ProFormText name="email" label="E-mail（可空）" placeholder="例如: customer@example.com" />
        <ProFormText name="note" label="備註（可空）" />
        <ProFormSwitch name="is_active" label="啟用" />
      </ModalForm>
    </>
  );
}

