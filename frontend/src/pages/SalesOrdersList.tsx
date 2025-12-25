import React, { useRef, useState, useEffect } from 'react';
import { Button, message, DatePicker, Tag, Tabs, Space } from 'antd';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

type Row = {
  id: number;
  so_no: string;
  doc_date?: string;
  customer_name: string;
  status: string;
  is_paid?: boolean;
  paid_at?: string;
  items?: any[];
  created_at?: string;
  picked_at?: string;
  shipped_at?: string;
  logistics_no?: string;
};

export default function SalesOrdersList() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [lastParams, setLastParams] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [statusPreset, setStatusPreset] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const ps = await api.listProducts();
        setProducts(ps || []);
      } catch {}
    })();
    (async () => {
      try {
        const cs = await api.listCustomers({});
        // 只显示启用的客户
        setCustomers((Array.isArray(cs) ? cs.filter((c: any) => c.is_active !== false) : []) || []);
      } catch {}
    })();
  }, []);

  const columns: ProColumns<Row>[] = [
    {
      title: '出貨時間區間',
      dataIndex: 'shipped_at_range',
      hideInTable: true,
      valueType: 'dateRange',
      fieldProps: {
        placeholder: ['開始日期', '結束日期'],
        style: { width: '100%' },
      },
      order: 1,
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
        style: { width: '100%' },
      },
      order: 2,
    },
    {
      title: '單號',
      dataIndex: 'so_no',
      width: isMobile ? 120 : 150,
      fixed: 'left',
      order: 3,
    },
    {
      title: '客戶',
      dataIndex: 'customer_name',
      hideInTable: false,
      valueType: 'select',
      width: isMobile ? 120 : 150,
      fieldProps: {
        showSearch: true,
        optionFilterProp: 'label',
        options: customers.map(c => ({
          label: c.name,
          value: c.name,
        })),
        placeholder: '請選擇客戶',
        allowClear: true,
        style: { width: '100%' },
      },
      order: 4,
    },
    {
      title: '出貨時間',
      dataIndex: 'shipped_at',
      valueType: 'dateTime',
      search: false,
      hideInTable: false,
      width: isMobile ? 140 : 160,
      fixed: isMobile ? false : 'left',
      defaultSortOrder: 'descend',
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
      title: '狀態',
      dataIndex: 'status',
      valueType: 'select',
      width: isMobile ? 80 : 100,
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
      title: '付款狀態',
      dataIndex: 'is_paid',
      valueType: 'select',
      width: isMobile ? 90 : 100,
      valueEnum: {
        true: { text: '已付款', status: 'Success' },
        false: { text: '未付款', status: 'Warning' },
      },
      fieldProps: {
        placeholder: '請選擇',
        allowClear: true,
      },
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
    {
      title: '物流單號',
      dataIndex: 'logistics_no',
      search: false,
      hideInTable: false,
      width: isMobile ? 100 : 120,
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
      width: isMobile ? 70 : 80,
      align: 'right',
      render: (_, r) => (r.items ? r.items.length : 0),
    },
    { title: '建立時間', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: isMobile ? 150 : 180 },
    {
      title: '操作',
      valueType: 'option',
      width: isMobile ? 80 : 100,
      fixed: 'right',
      render: (_, r) => [
        <Button key="view" type="link" size="small" onClick={() => nav(`/sales-orders/${r.id}`)}>
          查看
        </Button>,
      ],
    },
    // TODO: 操作：查看明細、列印 PDF（你已有 detail / print 的話再接）
  ];

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
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
        size={isMobile ? 'small' : 'middle'}
        tabBarStyle={isMobile ? { marginBottom: 8 } : undefined}
      />
      <ProTable<Row>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        headerTitle="銷貨單查詢"
        scroll={{ 
          x: isMobile ? 1100 : 1500,
          scrollToFirstRowOnChange: true,
        }}
        style={{ 
          width: '100%',
        }}
        size={isMobile ? 'small' : 'middle'}
        tableStyle={{
          minWidth: isMobile ? 1100 : 'auto',
        }}
        toolBarRender={() => [
          <Button
            key="refresh"
            size={isMobile ? 'small' : 'middle'}
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
            size={isMobile ? 'small' : 'middle'}
            onClick={async () => {
            try {
              const blob = await api.exportSOsXlsx(lastParams);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              const from = lastParams.shipped_at_from || lastParams.date_from || '';
              const to = lastParams.shipped_at_to || lastParams.date_to || '';
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

        // 出貨時間區間：從 shipped_at_range 解析（優先使用）
        const shippedRange = params.shipped_at_range as any[] | undefined;
        let shipped_at_from: string | undefined;
        let shipped_at_to: string | undefined;
        if (shippedRange?.length === 2) {
          shipped_at_from = dayjs(shippedRange[0]).format('YYYY-MM-DD');
          shipped_at_to = dayjs(shippedRange[1]).format('YYYY-MM-DD');
        }

        // 兼容舊的 date_range（如果沒有 shipped_at_range）
        const dr = params.date_range as any[] | undefined;
        let date_from: string | undefined;
        let date_to: string | undefined;
        if (!shipped_at_from && dr?.length === 2) {
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
        // 付款狀態篩選
        if (params.is_paid !== undefined && params.is_paid !== null) {
          query.is_paid = String(params.is_paid === true || params.is_paid === 'true');
        }
        // 優先使用出貨時間篩選
        if (shipped_at_from) query.shipped_at_from = shipped_at_from;
        if (shipped_at_to) query.shipped_at_to = shipped_at_to;
        // 向後兼容：如果沒有出貨時間篩選，使用 doc_date
        if (!shipped_at_from && date_from) query.date_from = date_from;
        if (!shipped_at_to && date_to) query.date_to = date_to;

        setLastParams(query);

        const res = await api.listSOs(query); // returns {rows,total}
        return {
          data: res.rows || [],
          total: res.total || 0,
          success: true,
        };
      }}
      pagination={{ 
        pageSize: 50,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        showTotal: (total) => `共 ${total} 條`,
        simple: isMobile,
        size: isMobile ? 'small' : 'default',
      }}
        search={{
          labelWidth: isMobile ? 80 : isTablet ? 100 : 120,
          span: isMobile ? 24 : isTablet ? 12 : 6,
          defaultCollapsed: true,
        optionRender: (searchConfig, formProps, dom) => {
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {dom}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  key="wk"
                  size="small"
                  onClick={() => {
                    const from = dayjs().startOf('isoWeek');
                    const to = dayjs().endOf('isoWeek');
                    formProps.form?.setFieldsValue({ shipped_at_range: [from, to] });
                    searchConfig?.form?.submit?.();
                  }}
                >
                  本週
                </Button>
                <Button
                  key="mo"
                  size="small"
                  onClick={() => {
                    const from = dayjs().startOf('month');
                    const to = dayjs().endOf('month');
                    formProps.form?.setFieldsValue({ shipped_at_range: [from, to] });
                    searchConfig?.form?.submit?.();
                  }}
                >
                  本月
                </Button>
                <Button
                  key="lm"
                  size="small"
                  onClick={() => {
                    const from = dayjs().subtract(1, 'month').startOf('month');
                    const to = dayjs().subtract(1, 'month').endOf('month');
                    formProps.form?.setFieldsValue({ shipped_at_range: [from, to] });
                    searchConfig?.form?.submit?.();
                  }}
                >
                  上月
                </Button>
                <Button
                  key="q"
                  size="small"
                  onClick={() => {
                    const from = dayjs().startOf('quarter');
                    const to = dayjs().endOf('quarter');
                    formProps.form?.setFieldsValue({ shipped_at_range: [from, to] });
                    searchConfig?.form?.submit?.();
                  }}
                >
                  本季
                </Button>
                <Button
                  key="y"
                  size="small"
                  onClick={() => {
                    const from = dayjs().startOf('year');
                    const to = dayjs().endOf('year');
                    formProps.form?.setFieldsValue({ shipped_at_range: [from, to] });
                    searchConfig?.form?.submit?.();
                  }}
                >
                  今年
                </Button>
              </div>
            </div>
          );
        },
      }}
      />
    </div>
  );
}

