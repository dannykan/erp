import React, { useRef, useState, useEffect } from 'react';
import { Button, Card, DatePicker, Select, Statistic, Row, Col, Tag, Table, message, Space } from 'antd';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

const { RangePicker } = DatePicker;

type SO = {
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
  total_amount?: number;
};

type Stats = {
  total_orders: number;
  total_amount: number;
  total_qty: number;
  avg_order_amount: number;
  first_order_date?: string;
  last_order_date?: string;
  orders_by_status: Record<string, number>;
  orders_this_month: number;
  orders_last_month: number;
  amount_this_month: number;
  amount_last_month: number;
};

export default function CustomerSalesHistory() {
  const actionRef = useRef<ActionType>();
  const nav = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any] | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const cs = await api.listCustomers({});
        setCustomers(Array.isArray(cs) ? cs.filter((c: any) => c.is_active) : []);
      } catch {
        message.error('載入客戶列表失敗');
      }
    })();
  }, []);

  const loadData = async (customerName: string, dateFrom?: string, dateTo?: string, page = 1, pageSize = 50) => {
    if (!customerName) {
      setStats(null);
      return { data: [], total: 0, success: true };
    }

    setLoading(true);
    try {
      const res = await api.customerHistory({
        customer_name: customerName,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        page_size: pageSize,
      });
      
      setStats(res.stats);
      
      // 计算每个订单的总金额
      const ordersWithAmount = res.orders.map((so: any) => {
        const totalAmount = so.items?.reduce((sum: number, item: any) => {
          return sum + (item.qty || 0) * (item.unit_price || 0);
        }, 0) || 0;
        return { ...so, total_amount: totalAmount };
      });

      return {
        data: ordersWithAmount,
        total: res.stats.total_orders,
        success: true,
      };
    } catch (e: any) {
      message.error('載入資料失敗');
      setStats(null);
      return { data: [], total: 0, success: false };
    } finally {
      setLoading(false);
    }
  };

  const columns: ProColumns<SO>[] = [
    { title: '銷貨單號', dataIndex: 'so_no', copyable: true, width: 150, fixed: 'left' },
    { title: '單據日期', dataIndex: 'doc_date', valueType: 'date', width: 120 },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        DRAFT: { text: '待出貨', status: 'Default' },
        PICKED: { text: '已揀貨', status: 'Processing' },
        SHIPPED: { text: '已出貨', status: 'Success' },
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
      title: '金額',
      dataIndex: 'total_amount',
      width: 120,
      search: false,
      align: 'right',
      render: (_, r) => {
        const amount = r.total_amount || 0;
        return amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      },
    },
    {
      title: '品項數',
      dataIndex: 'items',
      width: 90,
      search: false,
      align: 'right',
      render: (_, r) => (r.items ? r.items.length : 0),
    },
    {
      title: '出貨時間',
      dataIndex: 'shipped_at',
      width: 160,
      search: false,
      render: (_, r) => r.shipped_at ? dayjs(r.shipped_at).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, r) => [
        <Button key="view" type="link" size="small" onClick={() => nav(`/sales-orders/${r.id}`)}>
          查看
        </Button>,
      ],
    },
  ];

  return (
    <div>
      <Card
        title="客戶銷貨單歷史查詢"
        extra={
          <Space wrap size="small">
            <Select
              showSearch
              placeholder="請選擇客戶"
              style={{ width: 250, minWidth: 200 }}
              value={selectedCustomer}
              onChange={(value) => {
                setSelectedCustomer(value);
                if (value) {
                  actionRef.current?.reload();
                } else {
                  setStats(null);
                }
              }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map((c: any) => ({
                label: c.name,
                value: c.name,
              }))}
            />
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates as any);
                if (selectedCustomer) {
                  actionRef.current?.reload();
                }
              }}
              allowClear
              style={{ width: 240 }}
            />
            <Button
              onClick={() => {
                setDateRange(undefined);
                setSelectedCustomer(undefined);
                setStats(null);
                actionRef.current?.reload();
              }}
            >
              清除
            </Button>
          </Space>
        }
      >
        {stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="總訂單數"
                  value={stats.total_orders}
                  suffix="單"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="總金額"
                  value={stats.total_amount}
                  precision={0}
                  suffix="元"
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="平均訂單金額"
                  value={stats.avg_order_amount}
                  precision={0}
                  suffix="元"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="總數量"
                  value={stats.total_qty}
                  precision={0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="本月訂單"
                  value={stats.orders_this_month}
                  suffix="單"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="本月金額"
                  value={stats.amount_this_month}
                  precision={0}
                  suffix="元"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="上月訂單"
                  value={stats.orders_last_month}
                  suffix="單"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="上月金額"
                  value={stats.amount_last_month}
                  precision={0}
                  suffix="元"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ marginBottom: 8 }}>訂單狀態分布</div>
                <div>
                  <Tag color="default">待出貨: {stats.orders_by_status.DRAFT || 0}</Tag>
                  <Tag color="processing">已揀貨: {stats.orders_by_status.PICKED || 0}</Tag>
                  <Tag color="success">已出貨: {stats.orders_by_status.SHIPPED || 0}</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ marginBottom: 8 }}>首次訂單</div>
                <div>{stats.first_order_date ? dayjs(stats.first_order_date).format('YYYY-MM-DD') : '-'}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <div style={{ marginBottom: 8 }}>最近訂單</div>
                <div>{stats.last_order_date ? dayjs(stats.last_order_date).format('YYYY-MM-DD') : '-'}</div>
              </Card>
            </Col>
          </Row>
        )}

        <ProTable<SO>
          rowKey="id"
          actionRef={actionRef}
          columns={columns}
          headerTitle={selectedCustomer ? `${selectedCustomer} - 銷貨單列表` : '請選擇客戶'}
          loading={loading}
          search={false}
          scroll={{ x: 1000 }}
          pagination={{ 
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 條`,
          }}
          toolBarRender={() => [
            <Button
              key="thisMonth"
              onClick={() => {
                const from = dayjs().startOf('month');
                const to = dayjs().endOf('month');
                setDateRange([from, to] as any);
                if (selectedCustomer) {
                  actionRef.current?.reload();
                }
              }}
            >
              本月
            </Button>,
            <Button
              key="lastMonth"
              onClick={() => {
                const from = dayjs().subtract(1, 'month').startOf('month');
                const to = dayjs().subtract(1, 'month').endOf('month');
                setDateRange([from, to] as any);
                if (selectedCustomer) {
                  actionRef.current?.reload();
                }
              }}
            >
              上月
            </Button>,
            <Button
              key="thisYear"
              onClick={() => {
                const from = dayjs().startOf('year');
                const to = dayjs().endOf('year');
                setDateRange([from, to] as any);
                if (selectedCustomer) {
                  actionRef.current?.reload();
                }
              }}
            >
              今年
            </Button>,
          ]}
          request={async (params) => {
            if (!selectedCustomer) {
              return { data: [], total: 0, success: true };
            }

            const page = params.current || 1;
            const pageSize = params.pageSize || 50;
            
            const dateFrom = dateRange?.[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined;
            const dateTo = dateRange?.[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined;

            return loadData(selectedCustomer, dateFrom, dateTo, page, pageSize);
          }}
        />
      </Card>
    </div>
  );
}

