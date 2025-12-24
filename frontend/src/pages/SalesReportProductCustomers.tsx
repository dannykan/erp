import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, Select, message } from 'antd';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { api } from '../app/api';

const { RangePicker } = DatePicker;

type Row = {
  customer_name: string;
  order_count: number;
  total_qty: number;
  total_amount: number;
  last_unit_price: number;
  last_price_unit: string;
  last_order_date?: string;
};

export default function SalesReportProductCustomers() {
  const actionRef = useRef<ActionType>();
  const [products, setProducts] = useState<any[]>([]);
  const [lastParams, setLastParams] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const ps = await api.listProducts();
        setProducts(ps || []);
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  const columns: ProColumns<Row>[] = [
    {
      title: '日期區間',
      dataIndex: 'date_range',
      hideInTable: true,
      renderFormItem: () => <RangePicker allowClear />,
    },
    {
      title: '品項',
      dataIndex: 'product_id',
      hideInTable: true,
      renderFormItem: (_, __, form) => (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="搜尋品項（SKU/品名）"
          options={products.map((p) => ({
            label: `${p.sku ? p.sku + ' - ' : ''}${p.name}`,
            value: p.id,
          }))}
          onChange={() => {
            // 選完品項就直接查一次也可以（可選）
            // form?.submit?.();
          }}
        />
      ),
      rules: [{ required: true, message: '請先選擇品項' }],
    },
    { title: '客戶', dataIndex: 'customer_name', search: false },
    { title: '訂單數', dataIndex: 'order_count', width: 90, search: false },
    { title: '總數量', dataIndex: 'total_qty', width: 110, search: false },
    { title: '總金額', dataIndex: 'total_amount', width: 120, search: false },
    { title: '最近單價', dataIndex: 'last_unit_price', width: 110, search: false },
    { title: '報價單位', dataIndex: 'last_price_unit', width: 90, search: false },
    { title: '最近訂購日', dataIndex: 'last_order_date', width: 120, search: false },
  ];

  return (
    <ProTable<Row>
      rowKey="customer_name"
      actionRef={actionRef}
      headerTitle="銷售報表 - 品項 → 客戶"
      columns={columns}
      toolBarRender={() => [
        <Button
          key="export"
          type="primary"
          onClick={async () => {
            if (!lastParams.product_id) {
              message.warning('請先選擇品項並查詢');
              return;
            }
            try {
              const blob = await api.exportProductCustomersXlsx(lastParams);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              const from = lastParams.date_from || 'all';
              const to = lastParams.date_to || 'all';
              a.href = url;
              a.download = `product_customers_${lastParams.product_id}_${from}_${to}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
            } catch {
              message.error('匯出失敗');
            }
          }}
        >
          匯出 Excel
        </Button>,
      ]}
      request={async (params) => {
        // 必填 product_id：沒有就不查
        const pid = params.product_id;
        if (!pid) {
          return { data: [], total: 0, success: true };
        }

        const q: any = { product_id: String(pid) };
        const dr = params.date_range as any[] | undefined;
        if (dr?.length === 2) {
          q.date_from = dayjs(dr[0]).format('YYYY-MM-DD');
          q.date_to = dayjs(dr[1]).format('YYYY-MM-DD');
        }

        setLastParams(q);

        const res = await api.productCustomers(q);
        return { data: res.rows || [], total: (res.rows || []).length, success: true };
      }}
      search={{
        labelWidth: 80,
        optionRender: (searchConfig, formProps, dom) => [
          ...dom,
          <Button
            key="month"
            onClick={() => {
              const from = dayjs().startOf('month');
              const to = dayjs().endOf('month');
              formProps.form?.setFieldsValue({ date_range: [from, to] });
              searchConfig?.form?.submit?.();
            }}
          >
            本月
          </Button>,
          <Button
            key="lastMonth"
            onClick={() => {
              const from = dayjs().subtract(1, 'month').startOf('month');
              const to = dayjs().subtract(1, 'month').endOf('month');
              formProps.form?.setFieldsValue({ date_range: [from, to] });
              searchConfig?.form?.submit?.();
            }}
          >
            上月
          </Button>,
        ],
      }}
      pagination={false}
    />
  );
}

