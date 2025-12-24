import React, { useRef, useState, useEffect } from 'react';
import { Button, message, DatePicker, Tag, Tabs } from 'antd';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '../app/api';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

type Row = {
  id: number;
  so_no: string;
  doc_date?: string;
  customer_name: string;
  status: string;
  items?: any[];
  created_at?: string;
  picked_at?: string;
  shipped_at?: string;
  logistics_no?: string;
};

export default function SalesOrdersList() {
  const actionRef = useRef<ActionType>();
  const [lastParams, setLastParams] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [statusPreset, setStatusPreset] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const ps = await api.listProducts();
        setProducts(ps || []);
      } catch {}
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
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        optionFilterProp: 'label',
        options: products.map(p => ({
          label: `${p.sku ? p.sku + ' - ' : ''}${p.name}`,
          value: p.id,
        })),
        placeholder: '搜尋品項（SKU/品名）',
      },
    },
    { title: '單號', dataIndex: 'so_no' },
    { title: '日期', dataIndex: 'doc_date', valueType: 'date' },
    { title: '客戶', dataIndex: 'customer_name' },
    {
      title: '狀態',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        DRAFT: { text: '待出貨', status: 'Default' },
        PICKED: { text: '已揀貨', status: 'Processing' },
        SHIPPED: { text: '已出貨', status: 'Success' },
      },
      // 当 Tab 不是 all 时，禁用 status 字段（避免 UI 困惑）
      fieldProps: {
        disabled: !!statusPreset,
      },
      render: (_, r) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          DRAFT: { text: '待出貨', color: 'default' },
          PICKED: { text: '已揀貨', color: 'processing' },
          SHIPPED: { text: '已出貨', color: 'success' },
        };
        const s = statusMap[r.status] || { text: r.status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '出貨時間',
      dataIndex: 'shipped_at',
      valueType: 'dateTime',
      search: false,
      hideInTable: false,
      sorter: (a, b) => {
        // 已出货的排在前面，然后按时间倒序
        if (a.shipped_at && !b.shipped_at) return -1;
        if (!a.shipped_at && b.shipped_at) return 1;
        if (!a.shipped_at && !b.shipped_at) return 0;
        return dayjs(b.shipped_at).valueOf() - dayjs(a.shipped_at).valueOf();
      },
      render: (_, r) => r.shipped_at ? dayjs(r.shipped_at).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '物流單號',
      dataIndex: 'logistics_no',
      search: false,
      hideInTable: false,
      render: (_, r) => {
        // 只有已出货才显示物流单号
        if (r.status === 'SHIPPED' && r.logistics_no) {
          return r.logistics_no;
        }
        return '-';
      },
    },
    {
      title: '品項數',
      dataIndex: 'items',
      search: false,
      render: (_, r) => (r.items ? r.items.length : 0),
    },
    { title: '建立時間', dataIndex: 'created_at', valueType: 'dateTime', search: false },
    // TODO: 操作：查看明細、列印 PDF（你已有 detail / print 的話再接）
  ];

  return (
    <>
      <Tabs
        activeKey={statusPreset || 'all'}
        onChange={(key) => {
          const newStatus = key === 'all' ? undefined : key;
          setStatusPreset(newStatus);
          // 重置到第一页和默认 pageSize，并重新加载
          actionRef.current?.setPageInfo?.({ current: 1, pageSize: 50 });
          actionRef.current?.reload?.();
        }}
        items={[
          { key: 'all', label: '全部' },
          { key: 'DRAFT', label: '待揀貨' },
          { key: 'PICKED', label: '待出貨' },
          { key: 'SHIPPED', label: '已出貨' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <ProTable<Row>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        headerTitle="銷貨單查詢"
      toolBarRender={() => [
        <Button
          key="thisMonth"
          onClick={() => {
            actionRef.current?.setPageInfo?.({ current: 1 });
            actionRef.current?.reload?.();
          }}
        >
          更新
        </Button>,
        <Button
          key="export"
          type="primary"
          onClick={async () => {
            try {
              const blob = await api.exportSOsXlsx(lastParams);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              const from = lastParams.date_from || '';
              const to = lastParams.date_to || '';
              const customer = lastParams.customer_name_like || '';
              const status = lastParams.status || '';
              
              // 檔名格式：so_export_YYYYMMDD_YYYYMMDD_customer_status.xlsx
              let filename = 'so_export';
              if (from && to) {
                filename += `_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}`;
              } else {
                filename += '_all';
              }
              if (customer) {
                filename += `_${customer.substring(0, 10)}`;
              }
              if (status) {
                filename += `_${status}`;
              }
              filename += '.xlsx';
              
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
            } catch (e: any) {
              message.error('匯出失敗');
            }
          }}
        >
          匯出 Excel
        </Button>,
      ]}
      request={async (params) => {
        // ProTable params: current/pageSize + 表單欄位
        const page = params.current || 1;
        const page_size = params.pageSize || 50;

        // customer_name_like 用「客戶」欄位（ProTable 預設用 dataIndex）
        const customer_name_like = (params.customer_name as string | undefined)?.trim();

        // 日期區間：從 date_range 解析
        const dr = params.date_range as any[] | undefined;
        let date_from: string | undefined;
        let date_to: string | undefined;
        if (dr?.length === 2) {
          date_from = dayjs(dr[0]).format('YYYY-MM-DD');
          date_to = dayjs(dr[1]).format('YYYY-MM-DD');
        }

        const query: any = {
          page: String(page),
          page_size: String(page_size),
        };
        if (customer_name_like) query.customer_name_like = customer_name_like;
        // Tab 切换的 status 优先于表单筛选的 status
        if (statusPreset) {
          query.status = statusPreset;
        } else if (params.status) {
          query.status = params.status;
        }
        if (params.product_id) query.product_id = String(params.product_id);
        if (date_from) query.date_from = date_from;
        if (date_to) query.date_to = date_to;

        setLastParams(query);

        const res = await api.listSOs(query); // returns {rows,total}
        return {
          data: res.rows || [],
          total: res.total || 0,
          success: true,
        };
      }}
      pagination={{ pageSize: 50 }}
      search={{
        labelWidth: 80,
        optionRender: (searchConfig, formProps, dom) => {
          return [
            ...dom,
            <Button
              key="wk"
              onClick={() => {
                const from = dayjs().startOf('isoWeek');
                const to = dayjs().endOf('isoWeek');
                formProps.form?.setFieldsValue({ date_range: [from, to] });
                searchConfig?.form?.submit?.();
              }}
            >
              本週
            </Button>,
            <Button
              key="mo"
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
              key="lm"
              onClick={() => {
                const from = dayjs().subtract(1, 'month').startOf('month');
                const to = dayjs().subtract(1, 'month').endOf('month');
                formProps.form?.setFieldsValue({ date_range: [from, to] });
                searchConfig?.form?.submit?.();
              }}
            >
              上月
            </Button>,
            <Button
              key="q"
              onClick={() => {
                const from = dayjs().startOf('quarter');
                const to = dayjs().endOf('quarter');
                formProps.form?.setFieldsValue({ date_range: [from, to] });
                searchConfig?.form?.submit?.();
              }}
            >
              本季
            </Button>,
            <Button
              key="y"
              onClick={() => {
                const from = dayjs().startOf('year');
                const to = dayjs().endOf('year');
                formProps.form?.setFieldsValue({ date_range: [from, to] });
                searchConfig?.form?.submit?.();
              }}
            >
              今年
            </Button>,
          ];
        },
      }}
      />
    </>
  );
}

