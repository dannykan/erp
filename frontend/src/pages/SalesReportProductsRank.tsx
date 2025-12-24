import React, { useEffect, useRef, useState } from 'react';
import { Button, DatePicker, message } from 'antd';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { api } from '../app/api';

const { RangePicker } = DatePicker;

type Row = {
  product_id: number;
  sku?: string;
  name: string;
  order_count: number;
  customer_count: number;
  total_qty: number;
  total_amount: number;
};

export default function SalesReportProductsRank() {
  const actionRef = useRef<ActionType>();
  const [lastParams, setLastParams] = useState<any>({ top_n: '50' });

  const columns: ProColumns<Row>[] = [
    {
      title: '日期區間',
      dataIndex: 'date_range',
      hideInTable: true,
      renderFormItem: () => <RangePicker allowClear />,
    },
    {
      title: 'Top N',
      dataIndex: 'top_n',
      valueType: 'digit',
      hideInTable: true,
      initialValue: 50,
      fieldProps: { min: 1, max: 500 },
    },
    { title: '品項ID', dataIndex: 'product_id', width: 90, search: false },
    { title: 'SKU', dataIndex: 'sku', width: 140, search: false },
    { title: '品名', dataIndex: 'name', search: false },
    { title: '訂單數', dataIndex: 'order_count', width: 90, search: false },
    { title: '客戶數', dataIndex: 'customer_count', width: 90, search: false },
    { title: '總數量', dataIndex: 'total_qty', width: 110, search: false },
    { title: '總金額', dataIndex: 'total_amount', width: 120, search: false },
  ];

  return (
    <ProTable<Row>
      rowKey="product_id"
      actionRef={actionRef}
      headerTitle="銷售報表 - 品項排行"
      columns={columns}
      toolBarRender={() => [
        <Button
          key="export"
          type="primary"
          onClick={async () => {
            try {
              const blob = await api.exportProductsRankXlsx(lastParams);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              const from = lastParams.date_from || 'all';
              const to = lastParams.date_to || 'all';
              a.href = url;
              a.download = `products_rank_${from}_${to}_top${lastParams.top_n || 50}.xlsx`;
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
        const q: any = {};
        const dr = params.date_range as any[] | undefined;
        if (dr?.length === 2) {
          q.date_from = dayjs(dr[0]).format('YYYY-MM-DD');
          q.date_to = dayjs(dr[1]).format('YYYY-MM-DD');
        }
        q.top_n = String(params.top_n || 50);

        setLastParams(q);

        const res = await api.productsRank(q);
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

