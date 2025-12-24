import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Divider, Button, message, Space, Input, Alert } from 'antd';
import { ProForm, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

type Product = { id: number; sku?: string; name: string; spec?: string; unit: string; base_unit?: string; product_type?: string; is_active?: boolean; };

// 統一獲取商品單位：優先使用 base_unit
function getProductUnit(p?: Product): string {
  return p?.base_unit || p?.unit || '個';
}
type Item = {
  id: number;
  product_id?: number;
  spec_text?: string;
  qty: number;
  unit?: string;
  note?: string;
};

export default function ProductionNew() {
  const nav = useNavigate();
  const formRef = useRef<ProFormInstance>();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [loadingClone, setLoadingClone] = useState(false);
  const [quick, setQuick] = useState('');

  useEffect(() => {
    (async () => {
      const ps = await api.listProducts({});
      setProducts(ps);
    })();
  }, []);

  // 生產回報只能選 FG（成品）
  const fgProducts = useMemo(
    () => products.filter(p => p.product_type === 'FG' && p.is_active !== false),
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

  function toRowsFromPR(pr: any) {
    const rows = (pr.items || []).map((it: any) => {
      const p = productMap.get(it.product_id);
      return {
        id: Date.now() + Math.random(),
        product_id: it.product_id,
        spec_text: it.spec_text,
        qty: Number(it.qty || 0) > 0 ? it.qty : 1,
        unit: it.unit || getProductUnit(p),
        note: it.note,
      };
    });
    return rows;
  }

  function clearAllQty() {
    setItems((prev) => prev.map((r) => ({ ...r, qty: 0 })));
  }

  const columns: ProColumns<Item>[] = [
    {
      title: '商品',
      dataIndex: 'product_id',
      valueType: 'select',
      fieldProps: { options: productOptions, showSearch: true, optionFilterProp: 'label' },
      width: 360,
    },
    {
      title: '規格（今日）',
      dataIndex: 'spec_text',
      tooltip: '可留空；若今日實際規格與商品預設 spec 不同可填',
      width: 220,
    },
    { title: '數量', dataIndex: 'qty', valueType: 'digit', width: 110 },
    { title: '單位', dataIndex: 'unit', width: 90 },
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
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const it of items) {
      if (!it.product_id) continue;
      const k = `${it.product_id}::${(it.spec_text || '').trim()}`;
      if (seen.has(k)) dups.push(k);
      else seen.add(k);
    }
    return dups.length;
  })();

  const hugeQty = items.some((it) => Number(it.qty || 0) >= 5000);

  return (
    <Card title="新增生產回報（員工填寫）">
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Button
            loading={loadingClone}
            onClick={async () => {
              try {
                setLoadingClone(true);
                // 以你選的回報日期為 before（複製「最近一次 <= 該日」）
                const formValues = formRef.current?.getFieldsValue();
                const before = formValues?.report_date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD');
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
              const map = new Map<string, any>();
              for (const it of items) {
                if (!it.product_id) continue;
                const spec = (it.spec_text || '').trim();
                const k = `${it.product_id}::${spec}`;
                if (!map.has(k)) map.set(k, { ...it, id: Date.now() + Math.random() });
                else {
                  const cur = map.get(k);
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
              message.success('已合併重複品項/規格');
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

              const row = { id: Date.now(), product_id: found.id, spec_text: '', qty: 0, unit: getProductUnit(found), note: '' };
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
              message="有重複品項/規格，建議合併"
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
              report_date: v.report_date?.format('YYYY-MM-DD'),
              note: v.note,
              items: items.map(({ id, ...rest }) => ({
                ...rest,
                qty: Number(rest.qty),
              })),
            });
            message.success('已送出，等待廠長確認');
            nav('/production-reports/my');
            return true;
          } catch {
            message.error('送出失敗');
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
        <ProFormTextArea name="note" label="備註（可空）" fieldProps={{ rows: 3 }} />

        <Divider />

        <EditableProTable<Item>
          rowKey="id"
          headerTitle="今日生產明細"
          value={items}
          onChange={(v) => {
            // 自動帶出 unit：選了商品就補 unit（若使用者沒填），優先使用 base_unit
            const next = v.map((row) => {
              const p = productMap.get(row.product_id as number);
              return { ...row, unit: row.unit || getProductUnit(p) };
            });
            setItems(next);
          }}
          columns={columns}
          recordCreatorProps={{
            position: 'bottom',
            record: () => ({ id: Date.now(), qty: 1, unit: '個' }),
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onChange: setEditableKeys,
          }}
        />
      </ProForm>
    </Card>
  );
}

