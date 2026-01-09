import React, { useState, useEffect } from 'react';
import { Button, message, DatePicker, Card, Descriptions, Table, Space, Select, Tag } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { api } from '../app/api';
import { printFromPath } from '../app/printService';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

type MergedItem = {
  product_id: number;
  product_sku?: string;
  product_name: string;
  product_spec?: string;
  total_qty: number;
  unit: string;
  unit_price: number;
  price_unit: string;
  total_amount: number;
  source_so_nos: string[];
  mark?: string;
  note?: string;
};

type MergedData = {
  customer_name: string;
  customer_address?: string;
  customer_phone?: string;
  date_from?: string;
  date_to?: string;
  source_so_ids: number[];
  source_so_nos: string[];
  items: MergedItem[];
  total_amount: number;
  total_qty: number;
};

export default function MergedUnpaidSOs() {
  const nav = useNavigate();
  const { isMobile } = useResponsive();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [mergedData, setMergedData] = useState<MergedData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cs = await api.listCustomers();
        setCustomers(cs || []);
      } catch {}
    })();
  }, []);

  const handleQuery = async () => {
    if (!selectedCustomer) {
      message.warning('請選擇客戶');
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        customer_name: selectedCustomer,
      };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.shipped_at_from = dateRange[0].format('YYYY-MM-DD');
        params.shipped_at_to = dateRange[1].format('YYYY-MM-DD');
      }
      const data = await api.getMergedUnpaidSOs(params);
      setMergedData(data);
      if (!data.items || data.items.length === 0) {
        message.info('該客戶在指定時間範圍內沒有未付款的銷貨單');
      }
    } catch (e: any) {
      message.error('查詢失敗：' + (e.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedCustomer) {
      message.warning('請選擇客戶');
      return;
    }

    try {
      const params: any = {
        customer_name: selectedCustomer,
      };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.shipped_at_from = dateRange[0].format('YYYY-MM-DD');
        params.shipped_at_to = dateRange[1].format('YYYY-MM-DD');
      }
      const queryString = new URLSearchParams(params).toString();
      const filename = `合併未付款銷貨單_${selectedCustomer}_${dateRange?.[0]?.format('YYYYMMDD') || ''}_${dateRange?.[1]?.format('YYYYMMDD') || ''}.pdf`;
      
      await printFromPath(`/sales-orders/merged-unpaid/print.pdf?${queryString}`, {
        encoding: 'cp950',
        copies: 1,
        alsoDownload: false,
        filename,
      });
    } catch (e: any) {
      message.error('列印任務發送失敗：' + (e.message || '未知錯誤'));
    }
  };

  const itemColumns = [
    {
      title: '項',
      dataIndex: 'index',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '品名規格',
      dataIndex: 'product_name',
      width: 200,
      render: (_: any, record: MergedItem) => {
        const parts = [
          record.product_sku,
          record.product_name,
          record.product_spec,
        ].filter(Boolean);
        return parts.join(' ') || '-';
      },
    },
    {
      title: 'MARK',
      dataIndex: 'mark',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '報價單位',
      dataIndex: 'price_unit',
      width: 100,
    },
    {
      title: '件數(箱數)',
      dataIndex: 'total_qty',
      width: 100,
      align: 'right' as const,
      render: (qty: number, record: MergedItem) => (
        <strong>{qty.toFixed(2)} {record.unit}</strong>
      ),
    },
    {
      title: '單價',
      dataIndex: 'unit_price',
      width: 100,
      align: 'right' as const,
      render: (price: number) => `NT$${price.toFixed(2)}`,
    },
    {
      title: '小計',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right' as const,
      render: (amount: number) => <strong>NT${amount.toFixed(2)}</strong>,
    },
    {
      title: '來源單號',
      dataIndex: 'source_so_nos',
      width: 200,
      render: (so_nos: string[]) => (
        <div>
          {so_nos.map((no, idx) => (
            <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
              {no}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '備註',
      dataIndex: 'note',
      width: 150,
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div>
      <Card
        title="合併未付款銷貨單"
        extra={
          <Space>
            <Button onClick={() => nav('/sales-orders/list')}>返回</Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: '100%' }} size="middle">
            <Space wrap style={{ width: isMobile ? '100%' : 'auto' }}>
              <span style={{ width: isMobile ? '100%' : 100, display: 'inline-block' }}>客戶：</span>
              <Select
                style={{ width: isMobile ? '100%' : 300 }}
                showSearch
                placeholder="請選擇客戶"
                value={selectedCustomer || undefined}
                onChange={setSelectedCustomer}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={customers.map(c => ({
                  label: c.name,
                  value: c.name,
                }))}
              />
            </Space>
            <Space wrap style={{ width: isMobile ? '100%' : 'auto' }}>
              <span style={{ width: isMobile ? '100%' : 100, display: 'inline-block' }}>出貨時間：</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                allowClear
                style={{ width: isMobile ? '100%' : 300 }}
              />
            </Space>
            <Space wrap>
              <Button type="primary" onClick={handleQuery} loading={loading} size={isMobile ? 'small' : 'middle'}>
                查詢
              </Button>
              <Button
                onClick={handlePrint}
                disabled={!mergedData || !mergedData.items || mergedData.items.length === 0}
                size={isMobile ? 'small' : 'middle'}
              >
                列印 PDF
              </Button>
            </Space>
          </Space>
        </Space>
      </Card>

      {mergedData && mergedData.items && mergedData.items.length > 0 && (
        <Card title="合併結果">
          <ProDescriptions
            column={isMobile ? 1 : 2}
            dataSource={mergedData}
            columns={[
              {
                title: '客戶名稱',
                dataIndex: 'customer_name',
              },
              {
                title: '送貨地址',
                dataIndex: 'customer_address',
              },
              {
                title: '聯繫電話',
                dataIndex: 'customer_phone',
              },
              {
                title: '出貨時間',
                dataIndex: 'date_range',
                render: () => {
                  if (mergedData.date_from && mergedData.date_to) {
                    return `${mergedData.date_from} 至 ${mergedData.date_to}`;
                  } else if (mergedData.date_from) {
                    return `${mergedData.date_from} 起`;
                  } else if (mergedData.date_to) {
                    return `至 ${mergedData.date_to}`;
                  }
                  return '全部';
                },
              },
              {
                title: '來源單號',
                dataIndex: 'source_so_nos',
                span: 2,
                render: (so_nos: string[]) => (
                  <div>
                    {so_nos.map((no, idx) => (
                      <Tag key={idx} color="blue" style={{ marginRight: 8 }}>
                        {no}
                      </Tag>
                    ))}
                  </div>
                ),
              },
              {
                title: '總件數',
                dataIndex: 'total_qty',
                render: (qty: number) => <strong>{qty.toFixed(2)}</strong>,
              },
              {
                title: '銷貨總金額',
                dataIndex: 'total_amount',
                render: (amount: number) => (
                  <strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                    NT${amount.toFixed(2)}
                  </strong>
                ),
              },
            ]}
          />

          <Table
            dataSource={mergedData.items}
            columns={itemColumns}
            rowKey={(record, index) => `${record.product_id}_${record.mark || ''}_${index}`}
            pagination={false}
            scroll={{ x: isMobile ? 1000 : 1200 }}
            style={{ marginTop: 16 }}
            size={isMobile ? 'small' : 'middle'}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4} align="right">
                    <strong>總計：</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong>{mergedData.total_qty.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={3} align="right">
                    <strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                      NT${mergedData.total_amount.toFixed(2)}
                    </strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}
    </div>
  );
}

