import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Divider, Button, message, Space, Input, Alert } from 'antd';
import { ProForm, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import FactoryProductSelectionModal from '../components/FactoryProductSelectionModal';

type Product = { id: number; sku?: string; name: string; spec?: string; unit: string; base_unit?: string; product_type?: string; is_active?: boolean; };

// 統一獲取商品單位：優先使用 base_unit
function getProductUnit(p?: Product): string {
  return p?.base_unit || p?.unit || '個';
}
type Item = {
  id: number;
  product_id?: number;
  spec_text?: string | null;
  qty: number;
  unit?: string;
  note?: string | null;
};

export default function ProductionNew() {
  const nav = useNavigate();
  const formRef = useRef<ProFormInstance>();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [loadingClone, setLoadingClone] = useState(false);
  const [quick, setQuick] = useState('');
  const [productSelectionModalOpen, setProductSelectionModalOpen] = useState(false);
  const [activeRowKeyForProductSelect, setActiveRowKeyForProductSelect] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      const ps = await api.listProducts({});
      setProducts(ps);
    })();
  }, []);

  // 生產回報只能選 FG（成品），且只選竹筷類別
  const fgProducts = useMemo(
    () => products.filter(p => 
      p.product_type === 'FG' && 
      p.is_active !== false &&
      p.name.includes('[ 竹筷 ]')
    ),
    [products],
  );

  const productOptions = useMemo(
    () =>
      fgProducts.map((p) => ({
        label: `${p.sku ? p.sku + ' - ' : ''}${p.name}${p.spec ? ` (${p.spec})` : ''}`,
        value: p.id,
      })),
    [fgProducts],
  );

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  // 快速新增時也要過濾 FG
  const fgProductMap = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of fgProducts) m.set(p.id, p);
    return m;
  }, [fgProducts]);

  // 單位選項
  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    products.forEach(p => {
      if (p.base_unit) units.add(p.base_unit);
      if (p.unit) units.add(p.unit);
    });
    // 添加常見的單位
    ['件', '包', '箱', '盒', '袋', '組', '打', '個', '雙'].forEach(u => units.add(u));
    return Array.from(units).sort().map(u => ({ label: u, value: u }));
  }, [products]);

  function toRowsFromPR(pr: any) {
    const rows = (pr.items || []).map((it: any) => {
      const p = productMap.get(it.product_id);
      return {
        id: Date.now() + Math.random(),
        product_id: it.product_id,
        spec_text: it.spec_text,
        qty: Number(it.qty || 0) > 0 ? it.qty : 1,
        unit: it.unit || '件',
        note: it.note,
      };
    });
    return rows;
  }

  function clearAllQty() {
    setItems((prev) => prev.map((r) => ({ ...r, qty: 0 })));
  }

  // 格式化日期：處理 dayjs 對象或字符串
  function formatDate(date: any): string {
    if (!date) return dayjs().format('YYYY-MM-DD');
    if (typeof date === 'string') return date;
    if (date.format && typeof date.format === 'function') {
      return date.format('YYYY-MM-DD');
    }
    return dayjs(date).format('YYYY-MM-DD');
  }

  const columns: ProColumns<Item>[] = [
    {
      title: '品項',
      dataIndex: 'product_id',
      width: 360,
      renderFormItem: (_, { record, isEditable }) => {
        if (!isEditable) return null;
        const p = fgProducts.find(p => p.id === record?.product_id);
        return (
          <Button
            type={p ? 'default' : 'primary'}
            onClick={() => {
              setActiveRowKeyForProductSelect(String(record?.id || ''));
              setProductSelectionModalOpen(true);
            }}
            style={{ width: '100%', textAlign: 'left' }}
          >
            {p ? (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {p.name}{p.brand ? ` ${p.brand}` : ''}
              </span>
            ) : (
              '選擇品項'
            )}
          </Button>
        );
      },
      render: (_: any, record: any) => {
        const p = fgProducts.find(p => p.id === record.product_id);
        if (!p) return '-';
        return `${p.name}${p.brand ? ` ${p.brand}` : ''}`;
      },
    },
    { title: '數量', dataIndex: 'qty', valueType: 'digit', width: 110 },
    {
      title: '單位',
      dataIndex: 'unit',
      valueType: 'select',
      fieldProps: {
        options: unitOptions,
        showSearch: true,
      },
      width: 120,
    },
    { title: '備註', dataIndex: 'note' },
    { title: '操作', valueType: 'option', width: 80 },
  ];

  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const subtotalByProduct = (() => {
    const m = new Map<number, number>();
    for (const it of items) {
      if (!it.product_id) continue;
      m.set(it.product_id, (m.get(it.product_id) || 0) + Number(it.qty || 0));
    }
    return Array.from(m.entries());
  })();

  // A2-2: 異常提示計算
  const duplicates = (() => {
    const seen = new Set<number>();
    const dups: number[] = [];
    for (const it of items) {
      if (!it.product_id) continue;
      if (seen.has(it.product_id)) dups.push(it.product_id);
      else seen.add(it.product_id);
    }
    return dups.length;
  })();

  const hugeQty = items.some((it) => Number(it.qty || 0) >= 5000);

  return (
    <Card 
      title="新增生產回報（員工填寫）"
      extra={<Button onClick={() => nav('/production-reports/my')}>返回</Button>}
    >
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Button
            loading={loadingClone}
            onClick={async () => {
              try {
                setLoadingClone(true);
                // 以你選的回報日期為 before（複製「最近一次 <= 該日」）
                const formValues = formRef.current?.getFieldsValue();
                const before = formatDate(formValues?.report_date);
                const last = await api.lastPR({ mine: true, before });
                const rows = toRowsFromPR(last);
                setItems(rows);
                setEditableKeys(rows.map((r) => r.id));
                message.success(`已載入最近一次回報：${last.pr_no}`);
              } catch {
                message.error('找不到可複製的歷史回報');
              } finally {
                setLoadingClone(false);
              }
            }}
          >
            複製最近一次
          </Button>

          <Button onClick={clearAllQty}>全部清零</Button>

          <Button
            onClick={() => {
              const map = new Map<number, any>();
              for (const it of items) {
                if (!it.product_id) continue;
                if (!map.has(it.product_id)) map.set(it.product_id, { ...it, id: Date.now() + Math.random() });
                else {
                  const cur = map.get(it.product_id);
                  cur.qty = Number(cur.qty || 0) + Number(it.qty || 0);
                  cur.unit = cur.unit || it.unit;
                  cur.note = [cur.note, it.note].filter(Boolean).join('; ');
                }
              }
              const merged = Array.from(map.values());
              // 保留沒有 product_id 的列（讓使用者可以繼續編輯）
              const withoutProduct = items.filter((it) => !it.product_id);
              const final = [...merged, ...withoutProduct];
              setItems(final);
              setEditableKeys(final.map((r) => r.id));
              message.success('已合併重複品項');
            }}
          >
            合併重複列
          </Button>

          <span style={{ fontWeight: 600 }}>今日總產量：{totalQty}</span>
          {subtotalByProduct.length > 0 && (
            <span style={{ color: '#666' }}>
              （小計：{subtotalByProduct
                .slice(0, 5)
                .map(([pid, qty]) => `#${pid}=${qty}`)
                .join('、')}
              {subtotalByProduct.length > 5 ? '…' : ''}）
            </span>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            style={{ width: 260 }}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="快速新增：輸入SKU/品名按Enter"
            onPressEnter={(e) => {
              const k = quick.trim().toLowerCase();
              if (!k) return;

              const found = fgProducts.find((p) =>
                (p.sku || '').toLowerCase() === k
                || (p.sku || '').toLowerCase().includes(k)
                || (p.name || '').toLowerCase().includes(k)
              );

              if (!found) {
                message.warning('找不到商品，請改用下拉搜尋');
                (e.target as HTMLInputElement).select();
                return;
              }

              const row = { id: Date.now(), product_id: found.id, spec_text: null, qty: 0, unit: '件', note: null };
              const next = [...items, row];
              setItems(next);
              setEditableKeys([...editableKeys, row.id]);
              setQuick('');
            }}
          />
        </Space>
      </div>

      {(duplicates > 0 || hugeQty) && (
        <div style={{ marginBottom: 12 }}>
            {duplicates > 0 && (
            <Alert
              message="有重複品項，建議合併"
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
            />
          )}
          {hugeQty && (
            <Alert
              message="有超大數量，請確認是否多打一個 0"
              type="warning"
              showIcon
            />
          )}
        </div>
      )}

      <ProForm
        formRef={formRef}
        initialValues={{ report_date: dayjs() }}
        onFinish={async (v) => {
          if (!items.length) {
            message.error('請至少新增一筆明細');
            return false;
          }
          if (items.some((it) => !it.product_id)) {
            message.error('有明細尚未選商品');
            return false;
          }
          if (items.some((it) => Number(it.qty || 0) <= 0)) {
            message.error('數量需大於 0（若不生產請刪除該列）');
            return false;
          }

          try {
            await api.createPR({
              report_date: formatDate(v.report_date),
              note: v.note,
              items: items.map(({ id, ...rest }) => ({
                product_id: rest.product_id,
                spec_text: rest.spec_text || null,
                qty: Number(rest.qty),
                unit: rest.unit || '件',
                note: rest.note || null,
              })),
            });
            message.success('已送出，等待廠長確認');
            nav('/production-reports/my');
            return true;
          } catch (e: any) {
            console.error('Create PR error:', e);
            const errorMsg = e?.message || '送出失敗';
            message.error(`送出失敗：${errorMsg}`);
            return false;
          }
        }}
        submitter={{
          render: (_, dom) => (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => nav('/production-reports/my')}>取消</Button>
              {dom}
            </div>
          ),
        }}
      >
        <ProFormDatePicker name="report_date" label="回報日期" rules={[{ required: true }]} />

        <Divider />

        <EditableProTable<Item>
          rowKey="id"
          headerTitle="今日生產明細"
          value={items}
          onChange={setItems}
          columns={columns}
          recordCreatorProps={{
            position: 'bottom',
            record: () => ({ id: Date.now(), qty: 1, unit: '件', spec_text: null, note: null }),
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onChange: setEditableKeys,
          }}
        />

        <ProFormTextArea name="note" label="備註（可空）" fieldProps={{ rows: 3 }} />
      </ProForm>

      <FactoryProductSelectionModal
        open={productSelectionModalOpen}
        products={fgProducts}
        onClose={() => {
          setProductSelectionModalOpen(false);
          setActiveRowKeyForProductSelect(undefined);
        }}
        onSelect={(productId) => {
          if (activeRowKeyForProductSelect) {
            setItems((prev) =>
              prev.map((item) => {
                if (String(item.id) === activeRowKeyForProductSelect) {
                  const selectedProduct = fgProducts.find(p => p.id === productId);
                  return {
                    ...item,
                    product_id: productId,
                    unit: selectedProduct?.base_unit || selectedProduct?.unit || '件',
                  };
                }
                return item;
              })
            );
          } else {
            // 新增一行
            const selectedProduct = fgProducts.find(p => p.id === productId);
            const newItem: Item = {
              id: Date.now(),
              product_id: productId,
              spec_text: null,
              qty: 1,
              unit: selectedProduct?.base_unit || selectedProduct?.unit || '件',
              note: null,
            };
            setItems((prev) => [...prev, newItem]);
            setEditableKeys((prev) => [...prev, newItem.id]);
          }
          setProductSelectionModalOpen(false);
          setActiveRowKeyForProductSelect(undefined);
        }}
      />
    </Card>
  );
}

