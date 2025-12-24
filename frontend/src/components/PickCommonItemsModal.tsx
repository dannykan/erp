import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Input, InputNumber, Select, Space, message, Tag, Button, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../app/api';

type CommonRow = {
  product_id: number;
  sku?: string;
  name: string;
  last_unit_price: number;
  last_price_unit?: string;
  last_qty: number;
  last_order_date?: string;
  freq: number;
};

type Product = {
  id: number;
  sku?: string;
  name: string;
  spec?: string;
  pieces_per_case?: number;
  pack_quantity?: string;
};

type PickRow = CommonRow & {
  key: number;
  qty: number;
  case_qty: number;
  unit_price: number;
  price_unit: string;
  mark?: string;
  note?: string;
};

type Props = {
  open: boolean;
  customerName: string;
  onClose: () => void;
  onApply: (items: Array<{ product_id: number; qty: number; case_qty: number; unit_price: number; price_unit: string; mark?: string; note?: string }>) => void;
};

const COMMON_UNITS = ['件', '包', '箱', '盒', '袋', '組'];

export default function PickCommonItemsModal({ open, customerName, onClose, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PickRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!open) return;
    const cname = (customerName || '').trim();
    if (!cname) return;

    (async () => {
      setLoading(true);
      try {
        // 同時載入產品資訊
        const [commonData, productsData] = await Promise.all([
          api.commonSOItems(cname, 50),
          api.listProducts({}),
        ]);
        
        const productsMap = new Map<number, Product>();
        (productsData || []).forEach((p: Product) => {
          productsMap.set(p.id, p);
        });
        setProducts(productsData || []);

        console.log('Loading common items for customer:', cname);
        const data: CommonRow[] = commonData;
        console.log('Loaded common items:', data);
        const mapped: PickRow[] = (data || []).map((r) => {
          const lastQty = Number(r.last_qty ?? 0);
          return {
            ...r,
            key: r.product_id,
            qty: lastQty,
            case_qty: lastQty,
            unit_price: Number(r.last_unit_price ?? 0),
            price_unit: (r.last_price_unit || '件').trim() || '件',
            mark: '',
            note: '',
          };
        });
        setRows(mapped);
        setSelectedKeys(mapped.slice(0, 5).map((x) => x.key)); // 預選前 5 個（可依喜好移除）
      } catch (e: any) {
        setRows([]);
        setSelectedKeys([]);
        console.error('Failed to load common items:', e);
        console.error('Error details:', {
          message: e?.message,
          stack: e?.stack,
          customerName: cname,
        });
        // 嘗試解析錯誤信息
        let errorMsg = '讀取常用品項失敗';
        if (e?.message) {
          try {
            const errorData = JSON.parse(e.message);
            if (Array.isArray(errorData.detail)) {
              errorMsg = errorData.detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ');
            } else {
              errorMsg = errorData.detail || errorMsg;
            }
          } catch {
            errorMsg = e.message;
          }
        }
        message.error(errorMsg);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, customerName]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((r) => {
      const s = `${r.sku ?? ''} ${r.name ?? ''}`.toLowerCase();
      return s.includes(keyword);
    });
  }, [rows, q]);

  const filteredKeys = useMemo(() => filtered.map(r => r.key), [filtered]);

  const setQtyForSelected = (fn: (r: PickRow) => number) => {
    const keySet = new Set(selectedKeys);
    setRows(prev => prev.map(r => {
      if (keySet.has(r.key)) {
        const newQty = fn(r);
        return { ...r, qty: newQty, case_qty: newQty };
      }
      return r;
    }));
  };

  const getProductInfo = (productId: number): Product | undefined => {
    return products.find(p => p.id === productId);
  };

  const columns: ColumnsType<PickRow> = [
    {
      title: '項',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: '品名規格',
      width: 250,
      render: (_, r) => {
        const p = getProductInfo(r.product_id);
        const parts: string[] = [];
        if (p?.sku) parts.push(p.sku);
        if (p?.name) parts.push(p.name);
        if (p?.spec) parts.push(p.spec);
        return parts.length > 0 ? parts.join(' ') : (r.sku ? `${r.sku} ${r.name}` : r.name);
      },
    },
    {
      title: 'MARK',
      dataIndex: 'mark',
      width: 80,
      render: (_, r) => (
        <Input
          value={r.mark || ''}
          onChange={(e) => {
            setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, mark: e.target.value } : x)));
          }}
          placeholder=""
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '報價單位',
      dataIndex: 'price_unit',
      width: 100,
      render: (_, r) => (
        <Select
          value={r.price_unit || '件'}
          style={{ width: '100%' }}
          options={COMMON_UNITS.map((u) => ({ label: u, value: u }))}
          onChange={(val) => {
            setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, price_unit: val || '件' } : x)));
          }}
        />
      ),
    },
    {
      title: '件入數(箱入數)',
      width: 120,
      render: (_, r) => {
        const p = getProductInfo(r.product_id);
        return p?.pieces_per_case || '-';
      },
    },
    {
      title: '件數(箱數)',
      dataIndex: 'case_qty',
      width: 100,
      align: 'right',
      render: (_, r) => {
        const qty = Number(r.case_qty || r.qty || 0);
        return (
          <InputNumber
            min={0}
            value={qty}
            style={{ width: '100%', fontWeight: 700 }}
            onChange={(val) => {
              const n = Number(val ?? 0);
              setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, qty: n, case_qty: n } : x)));
            }}
          />
        );
      },
    },
    {
      title: '單價',
      dataIndex: 'unit_price',
      width: 100,
      align: 'right',
      render: (_, r) => {
        const price = Number(r.unit_price || 0);
        return (
          <InputNumber
            min={0}
            precision={2}
            value={price}
            style={{ width: '100%' }}
            formatter={(value) => `NT$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value?.replace(/NT\$\s?|(,*)/g, '') || ''}
            onChange={(val) => {
              const n = Number(val ?? 0);
              setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, unit_price: n } : x)));
            }}
          />
        );
      },
    },
    {
      title: '小計',
      width: 120,
      align: 'right',
      render: (_, r) => {
        const caseQty = Number(r.case_qty || r.qty || 0);
        const price = Number(r.unit_price || 0);
        const subtotal = (caseQty * price).toFixed(2);
        return <span style={{ fontWeight: 700 }}>NT${subtotal}</span>;
      },
    },
    {
      title: '備註',
      dataIndex: 'note',
      width: 150,
      render: (_, r) => (
        <Input
          value={r.note || ''}
          onChange={(e) => {
            setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, note: e.target.value } : x)));
          }}
          placeholder=""
          style={{ width: '100%' }}
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={`常用品項：${(customerName || '').trim() || '-'}`}
      width="90%"
      style={{ maxWidth: 1400 }}
      onCancel={onClose}
      okText="套用到訂單"
      onOk={() => {
        if (selectedKeys.length === 0) {
          message.warning('請先勾選要帶入的品項');
          return;
        }
        const picked = rows
          .filter((r) => selectedKeys.includes(r.key))
          .map((r) => ({
            product_id: r.product_id,
            qty: Number((r.case_qty || r.qty) ?? 0),
            case_qty: Number((r.case_qty || r.qty) ?? 0),
            unit_price: Number(r.unit_price ?? 0),
            price_unit: (r.price_unit || '件').trim() || '件',
            mark: r.mark || '',
            note: r.note || '',
          }));
        onApply(picked);
        onClose();
      }}
      confirmLoading={loading}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋 SKU / 品名"
          allowClear
        />

        <Space wrap>
          <Button
            onClick={() => {
              // 全選本頁（目前 filtered 的前 10 筆 = table pageSize）
              const pageSize = 10;
              const pageKeys = filtered.slice(0, pageSize).map(r => r.key);
              setSelectedKeys(Array.from(new Set([...selectedKeys, ...pageKeys])));
            }}
          >
            全選本頁
          </Button>

          <Button
            onClick={() => {
              // 全選全部（目前篩選結果）
              setSelectedKeys(filteredKeys);
            }}
          >
            全選全部
          </Button>

          <Button
            onClick={() => setSelectedKeys([])}
          >
            清空勾選
          </Button>

          <Divider type="vertical" />

          <Button
            onClick={() => {
              if (selectedKeys.length === 0) {
                message.warning('請先勾選品項');
                return;
              }
              setQtyForSelected(() => 0);
            }}
          >
            選取 件數(箱數) 清零
          </Button>

          <Button
            onClick={() => {
              if (selectedKeys.length === 0) {
                message.warning('請先勾選品項');
                return;
              }
              setQtyForSelected((r) => Number(r.last_qty ?? 0));
            }}
          >
            選取 件數(箱數)=上次
          </Button>

          <Button
            onClick={() => {
              if (selectedKeys.length === 0) {
                message.warning('請先勾選品項');
                return;
              }
              setQtyForSelected(() => 1);
            }}
          >
            選取 件數(箱數)=1
          </Button>
        </Space>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
        勾選後可調整件數(箱數)/單價/報價單位/MARK/備註，再套用到訂單
      </div>

      <Table
        rowKey="key"
        loading={loading}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
      />
    </Modal>
  );
}

