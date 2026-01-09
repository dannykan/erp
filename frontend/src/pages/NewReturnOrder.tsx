import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, message, Space, Select, Table, InputNumber, Checkbox, Divider } from 'antd';
import { ProForm, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

type Customer = { id: number; name: string; is_active: boolean; };
type SalesOrder = { id: number; so_no: string; customer_name: string; doc_date?: string; status: string; items: any[]; };
type ReturnItem = {
  id: number;
  source_so_item_id: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  original_qty: number;
  original_unit: string;
  original_unit_price: number;
  qty: number;
  unit: string;
  unit_price: number;
  note?: string;
};

export default function NewReturnOrder() {
  const nav = useNavigate();
  const formRef = React.useRef<ProFormInstance>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [selectedSO, setSelectedSO] = useState<number | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isStocked, setIsStocked] = useState(false);

  useEffect(() => {
    (async () => {
      const cs = await api.listCustomers({});
      setCustomers(cs.filter((c: Customer) => c.is_active));
    })();
  }, []);

  // 當選擇客戶時，載入該客戶的已出貨銷貨單
  useEffect(() => {
    if (!selectedCustomer) {
      setSalesOrders([]);
      setSelectedSO(null);
      setReturnItems([]);
      return;
    }
    (async () => {
      try {
        const sos = await api.listSOs({ customer_name_like: selectedCustomer, status: 'SHIPPED' });
        setSalesOrders(sos.rows || []);
      } catch (err: any) {
        message.error('載入銷貨單失敗：' + (err.message || '未知錯誤'));
      }
    })();
  }, [selectedCustomer]);

  // 當選擇銷貨單時，初始化退貨明細
  useEffect(() => {
    if (!selectedSO) {
      setReturnItems([]);
      return;
    }
    const so = salesOrders.find(s => s.id === selectedSO);
    if (!so) return;

    const items: ReturnItem[] = so.items.map((item: any, idx: number) => ({
      id: idx + 1,
      source_so_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name || `產品 #${item.product_id}`,
      product_sku: item.product_sku,
      original_qty: item.qty,
      original_unit: item.unit,
      original_unit_price: item.unit_price,
      qty: 0, // 預設為0，需要用戶選擇
      unit: item.unit,
      unit_price: item.unit_price,
      note: '',
    }));
    setReturnItems(items);
  }, [selectedSO, salesOrders]);

  const handleItemQtyChange = (id: number, qty: number) => {
    if (qty < 0) return;
    setReturnItems(prev => prev.map(item => {
      if (item.id === id) {
        const maxQty = item.original_qty;
        return { ...item, qty: Math.min(qty, maxQty) };
      }
      return item;
    }));
  };

  const handleItemPriceChange = (id: number, price: number) => {
    if (price < 0) return;
    setReturnItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, unit_price: price };
      }
      return item;
    }));
  };

  const handleItemUnitChange = (id: number, unit: string) => {
    setReturnItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, unit };
      }
      return item;
    }));
  };

  const columns = [
    {
      title: '產品名稱',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
      render: (_: any, record: ReturnItem) => (
        <div>
          <div>{record.product_sku ? `${record.product_sku} - ` : ''}{record.product_name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            原訂單：{record.original_qty} {record.original_unit} @ ${record.original_unit_price}
          </div>
        </div>
      ),
    },
    {
      title: '退貨數量',
      dataIndex: 'qty',
      key: 'qty',
      width: 120,
      render: (_: any, record: ReturnItem) => (
        <InputNumber
          value={record.qty}
          onChange={(value) => handleItemQtyChange(record.id, value || 0)}
          min={0}
          max={record.original_qty}
          precision={2}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '單位',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
      render: (_: any, record: ReturnItem) => {
        // 去重選項，避免重複的 key
        const allUnits = [
          record.original_unit,
          '件',
          '包',
          '箱',
          '個',
        ];
        const uniqueUnits = Array.from(new Set(allUnits));
        const options = uniqueUnits.map(unit => ({
          label: unit,
          value: unit,
        }));
        
        return (
          <Select
            value={record.unit}
            onChange={(value) => handleItemUnitChange(record.id, value)}
            style={{ width: '100%' }}
            options={options}
          />
        );
      },
    },
    {
      title: '單價',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (_: any, record: ReturnItem) => (
        <InputNumber
          value={record.unit_price}
          onChange={(value) => handleItemPriceChange(record.id, value || 0)}
          min={0}
          precision={2}
          prefix="$"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '小計',
      key: 'subtotal',
      width: 100,
      render: (_: any, record: ReturnItem) => (
        <span style={{ fontWeight: 'bold' }}>
          ${(record.qty * record.unit_price).toFixed(2)}
        </span>
      ),
    },
    {
      title: '備註',
      dataIndex: 'note',
      key: 'note',
      render: (_: any, record: ReturnItem) => (
        <input
          type="text"
          value={record.note || ''}
          onChange={(e) => {
            setReturnItems(prev => prev.map(item => {
              if (item.id === record.id) {
                return { ...item, note: e.target.value };
              }
              return item;
            }));
          }}
          style={{ width: '100%', border: '1px solid #d9d9d9', padding: '4px 8px', borderRadius: 4 }}
          placeholder="選填"
        />
      ),
    },
  ];

  const totalRefund = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
  }, [returnItems]);

  const selectedItems = useMemo(() => {
    return returnItems.filter(item => item.qty > 0);
  }, [returnItems]);

  return (
    <Card
      title="建立退貨單"
      extra={<Button onClick={() => nav('/return-orders')}>返回</Button>}
    >
      <ProForm
        formRef={formRef}
        initialValues={{ doc_date: dayjs() }}
        onFinish={async (v) => {
          if (!selectedCustomer) {
            message.error('請選擇客戶');
            return false;
          }
          if (!selectedSO) {
            message.error('請選擇銷貨單');
            return false;
          }
          if (selectedItems.length === 0) {
            message.error('請至少選擇一項退貨明細');
            return false;
          }

          try {
            await api.createReturnOrder({
              customer_name: selectedCustomer,
              source_so_id: selectedSO,
              doc_date: v.doc_date ? dayjs(v.doc_date).format('YYYY-MM-DD') : undefined,
              note: v.note,
              is_stocked: isStocked,
              items: selectedItems.map(item => ({
                source_so_item_id: item.source_so_item_id,
                qty: item.qty,
                unit: item.unit,
                unit_price: item.unit_price,
                note: item.note || undefined,
              })),
            });
            message.success('退貨單已建立');
            nav('/return-orders');
            return true;
          } catch (err: any) {
            message.error('建立失敗：' + (err.message || '未知錯誤'));
            return false;
          }
        }}
        submitter={{
          render: (_, dom) => (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => nav('/return-orders')}>取消</Button>
              {dom}
            </div>
          ),
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>選擇客戶：</label>
          <Select
            style={{ width: '100%' }}
            placeholder="請選擇客戶"
            value={selectedCustomer || undefined}
            onChange={(value) => setSelectedCustomer(value)}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={customers.map(c => ({ label: c.name, value: c.name }))}
          />
        </div>

        {selectedCustomer && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>選擇銷貨單：</label>
            <Select
              style={{ width: '100%' }}
              placeholder="請選擇銷貨單"
              value={selectedSO || undefined}
              onChange={(value) => setSelectedSO(value)}
              options={salesOrders.map(so => ({
                label: `${so.so_no} - ${so.doc_date || ''}`,
                value: so.id,
              }))}
            />
          </div>
        )}

        {selectedSO && (
          <>
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>退貨明細：</label>
              <Table
                dataSource={returnItems}
                columns={columns}
                rowKey="id"
                pagination={false}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4} align="right">
                        <strong>退款總金額：</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} colSpan={2}>
                        <strong style={{ fontSize: 18, color: '#52c41a' }}>
                          ${totalRefund.toFixed(2)}
                        </strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Checkbox
                checked={isStocked}
                onChange={(e) => setIsStocked(e.target.checked)}
              >
                直接入倉（確認退貨後自動增加庫存）
              </Checkbox>
            </div>
          </>
        )}

        <ProFormDatePicker name="doc_date" label="日期" rules={[{ required: true }]} />
        <ProFormTextArea name="note" label="備註（可空）" fieldProps={{ rows: 3 }} />
      </ProForm>
    </Card>
  );
}

