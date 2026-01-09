import React, { useEffect, useState, useMemo } from 'react';
import { Card, Divider, Button, message, Table } from 'antd';
import { ProForm, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';
import ProductSelectionModal from '../components/ProductSelectionModal';

type Product = { id: number; sku?: string; name: string; unit: string; base_unit?: string; quotation_unit?: string; pieces_per_case?: number; spec?: string; product_type?: string; is_active?: boolean; brand?: string; };

// 統一獲取商品單位：優先使用 base_unit
function getProductUnit(p?: Product): string {
  return p?.base_unit || p?.unit || '個';
}
type Item = { id: number; product_id?: number; qty: number; case_qty?: number; unit?: string; price_unit?: string; unit_price?: number; note?: string; mark?: string; };

export default function NewPurchaseOrder() {
  const nav = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [productSelectionModalOpen, setProductSelectionModalOpen] = useState(false);
  const [activeRowKeyForProductSelect, setActiveRowKeyForProductSelect] = useState<string | undefined>();
  
  // 收集所有商品的報價單位作為選項
  const priceUnitOptions = useMemo(() => {
    const units = new Set<string>();
    products.forEach(p => {
      if (p.quotation_unit) {
        units.add(p.quotation_unit);
      }
    });
    // 添加常見的單位
    ['件', '包', '箱', '盒', '袋', '組', '打', '個'].forEach(u => units.add(u));
    return Array.from(units).sort().map(u => ({ label: u, value: u }));
  }, [products]);

  useEffect(() => {
    (async () => {
      // 傳遞較大的 limit 以獲取所有產品
      const ps = await api.listProducts({ limit: 1000 });
      setProducts(ps);
    })();
  }, []);

  // 進貨單可以選所有類別的產品（FG、TRADE、RAW）
  const purchaseProducts = useMemo(
    () => products.filter(p => p.is_active !== false),
    [products],
  );

  const columns: ProColumns<Item>[] = [
    {
      title: '項',
      dataIndex: 'index',
      editable: false,
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: '品名規格',
      dataIndex: 'product_id',
      width: 250,
      renderFormItem: (_, { record, isEditable }) => {
        if (!isEditable) return null;
        const p = purchaseProducts.find(p => p.id === record?.product_id);
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
        const p = purchaseProducts.find(p => p.id === record.product_id);
        if (!p) return '-';
        return `${p.name}${p.brand ? ` ${p.brand}` : ''}`;
      },
    },
    {
      title: 'MARK',
      dataIndex: 'mark',
      width: 100,
    },
    {
      title: '報價單位',
      dataIndex: 'price_unit',
      valueType: 'select',
      fieldProps: {
        options: priceUnitOptions,
        showSearch: true,
        allowClear: false,
      },
      width: 100,
    },
    {
      title: '件入數(箱入數)',
      dataIndex: 'pieces_per_case',
      editable: false,
      width: 120,
      render: (_: any, record: any) => {
        const p = products.find(p => p.id === record.product_id);
        return p?.pieces_per_case || '-';
      },
    },
    {
      title: '件數(箱數)',
      dataIndex: 'case_qty',
      valueType: 'digit',
      width: 100,
      render: (_, row) => {
        const qty = Number(row.case_qty || row.qty || 0);
        return <span style={{ fontWeight: 700 }}>{qty}</span>;
      },
    },
    {
      title: '單價',
      dataIndex: 'unit_price',
      valueType: 'digit',
      width: 100,
      fieldProps: {
        precision: 2,
        min: 0,
      },
    },
    {
      title: '小計',
      editable: false,
      width: 100,
      render: (_: any, row: any) => {
        const qty = Number(row.case_qty || row.qty || 0);
        const price = Number(row.unit_price || 0);
        return (qty * price).toFixed(2);
      },
    },
    {
      title: '備註',
      dataIndex: 'note',
      width: 150,
    },
    { title: '操作', valueType: 'option', width: 80 },
  ];

  return (
    <Card 
      title="建立進貨單"
      extra={<Button onClick={() => nav('/purchase-orders')}>返回</Button>}
    >
      <ProForm
        onFinish={async (v) => {
          if (!items.length) return message.error('請至少一筆明細'), false;
          if (items.some(x => !x.product_id)) return message.error('明細商品未選'), false;

          try {
            await api.createPO({
              supplier_name: v.supplier_name,
              doc_date: v.doc_date,
              note: v.note,
              items: items.map(({ id, case_qty, price_unit, unit_price, mark, ...rest }) => ({
                ...rest,
                qty: Number(case_qty || rest.qty || 0),
              })),
            });
            message.success('已建立進貨單（庫存已入庫）');
            nav('/purchase-orders');
            return true;
          } catch (e: any) {
            message.error('建立失敗');
            return false;
          }
        }}
        submitter={{
          render: (_, dom) => (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => nav('/purchase-orders')}>取消</Button>
              {dom}
            </div>
          ),
        }}
      >
        <ProFormText name="supplier_name" label="供應商名稱" rules={[{ required: true }]} />
        <ProFormText name="supplier_address" label="送貨地址" />
        <ProFormText name="supplier_phone" label="聯繫電話" />
        <ProFormDatePicker name="doc_date" label="日期" />
        <ProFormText name="note" label="備註" />

        <Divider />

        <EditableProTable<Item>
          rowKey="id"
          headerTitle="進貨明細"
          value={items}
          scroll={{ x: 'max-content' }}
          onChange={(v) => {
            if (!v || !Array.isArray(v)) {
              return;
            }
            // 當選擇商品時，自動設置報價單位和件入數
            const next = v
              .filter(row => row != null)
              .map((row: any) => {
                // 確保每行都有 id
                if (!row.id) {
                  row.id = Date.now() + Math.random();
                }
                const p = purchaseProducts.find(p => p.id === row.product_id);
                if (p && row.product_id) {
                  // 如果 price_unit 還沒有設置或是預設值 '件'，自動帶入商品的 quotation_unit
                  const currentPriceUnit = row.price_unit;
                  const isDefaultValue = !currentPriceUnit || currentPriceUnit === '' || currentPriceUnit === '件';
                  const priceUnit = isDefaultValue && p.quotation_unit
                    ? p.quotation_unit
                    : (currentPriceUnit || p.quotation_unit || '件');
                  return {
                    ...row,
                    unit: row.unit || getProductUnit(p),
                    price_unit: priceUnit,
                    case_qty: row.case_qty ?? row.qty ?? 0,
                  };
                }
                return {
                  ...row,
                  unit: row.unit || '個',
                  price_unit: row.price_unit || '件',
                  case_qty: row.case_qty ?? row.qty ?? 0,
                };
              });
            setItems(next);
          }}
          columns={columns}
          recordCreatorProps={{
            position: 'bottom',
            newRecordType: 'dataSource',
            record: () => ({ id: Date.now(), qty: 1, case_qty: 1, unit: '個', price_unit: '', unit_price: 0 }),
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onChange: setEditableKeys,
            onValuesChange: (record, recordList) => {
              // 防護：確保 record 和 recordList 存在
              if (!record || !recordList || !Array.isArray(recordList)) {
                return;
              }
              
              // 確保 record 有 id
              const recordId = record.id || Date.now() + Math.random();
              
              // 當 product_id 變更時，自動更新該行的報價單位
              const updated = recordList
                .filter(row => row != null)
                .map((row: any) => {
                  const rowId = row.id || Date.now() + Math.random();
                  const rowWithId = { ...row, id: rowId };
                  
                  if (rowId === recordId && record.product_id !== undefined && record.product_id !== null) {
                    const p = purchaseProducts.find(p => p.id === record.product_id);
                    if (p) {
                      // 當選擇商品時，如果 price_unit 還沒有被手動設置過，則自動帶入商品的 quotation_unit
                      const currentPriceUnit = rowWithId.price_unit;
                      // 檢查是否是初始狀態（空、undefined、null 或預設值 '件'）
                      const isInitialState = !currentPriceUnit || currentPriceUnit === '' || currentPriceUnit === '件';
                      // 如果商品有 quotation_unit 且是初始狀態，則使用商品的 quotation_unit
                      const newPriceUnit = (isInitialState && p.quotation_unit) 
                        ? p.quotation_unit 
                        : (currentPriceUnit || p.quotation_unit || '件');
                      return {
                        ...rowWithId,
                        product_id: record.product_id,
                        unit: rowWithId.unit || getProductUnit(p),
                        price_unit: newPriceUnit,
                        case_qty: rowWithId.case_qty ?? rowWithId.qty ?? 0,
                      };
                    }
                  }
                  return rowWithId;
                });
              
              setItems(updated);
            },
          }}
          summary={() => {
            const totalQty = items.reduce((sum, it) => sum + Number((it.case_qty || it.qty) ?? 0), 0);
            const totalAmount = items.reduce((sum, it) => {
              const qty = Number((it.case_qty || it.qty) ?? 0);
              const price = Number(it.unit_price || 0);
              return sum + (qty * price);
            }, 0);
            
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right">
                    <strong>總件數：{totalQty}件</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} colSpan={5} align="right">
                    <strong>進貨總金額：{totalAmount.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </ProForm>

      <ProductSelectionModal
        open={productSelectionModalOpen}
        products={purchaseProducts}
        onClose={() => {
          setProductSelectionModalOpen(false);
          setActiveRowKeyForProductSelect(undefined);
        }}
        onSelect={(productId) => {
          if (activeRowKeyForProductSelect) {
            setItems((prev) =>
              prev.map((item) => {
                if (String(item.id) === activeRowKeyForProductSelect) {
                  const selectedProduct = purchaseProducts.find(p => p.id === productId);
                  const currentPriceUnit = item.price_unit;
                  const isDefaultValue = !currentPriceUnit || currentPriceUnit === '' || currentPriceUnit === '件';
                  const newPriceUnit = (isDefaultValue && selectedProduct?.quotation_unit)
                    ? selectedProduct.quotation_unit
                    : (currentPriceUnit || selectedProduct?.quotation_unit || '件');
                  return {
                    ...item,
                    product_id: productId,
                    unit: getProductUnit(selectedProduct),
                    price_unit: newPriceUnit,
                    case_qty: item.case_qty ?? item.qty ?? 0,
                  };
                }
                return item;
              })
            );
          } else {
            // 新增一行
            const selectedProduct = purchaseProducts.find(p => p.id === productId);
            const newItem: Item = {
              id: Date.now(),
              product_id: productId,
              qty: 1,
              case_qty: 1,
              unit: getProductUnit(selectedProduct),
              price_unit: selectedProduct?.quotation_unit || '件',
              unit_price: 0,
              note: '',
              mark: '',
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

