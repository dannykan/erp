import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, Divider, Button, App, Modal, Checkbox, Tooltip, Table } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormSelect, ProFormDatePicker } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import type { ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import CreateFGKitModal from '../components/CreateFGKitModal';
import PickCommonItemsModal from '../components/PickCommonItemsModal';
import ProductSelectionModal from '../components/ProductSelectionModal';

type Product = { id: number; sku?: string; name: string; unit: string; base_unit?: string; product_type?: string; is_active?: boolean; quotation_unit?: string; pieces_per_case?: number; pack_quantity?: string; model?: string; brand?: string; size?: string; origin?: string; };

// 統一獲取商品單位：優先使用 base_unit
function getProductUnit(p?: Product): string {
  return p?.base_unit || p?.unit || '個';
}
type Item = { id: number; product_id?: number; qty: number; unit?: string; price_unit?: string; unit_price?: number; note?: string; mark?: string; case_qty?: number; };
type Customer = { id: number; name: string; is_active: boolean; address?: string; phone?: string; };
type PriceHint = { unit_price: number; price_unit?: string };

export default function NewSalesOrder() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const soId = id ? Number(id) : undefined;
  const isEditMode = !!soId;
  const { me } = useAuth();
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  
  // 調試：顯示當前用戶角色
  console.log('Current user role:', me?.role);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, number>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [fgKitModalOpen, setFgKitModalOpen] = useState(false);
  const [activeRowKeyForCreate, setActiveRowKeyForCreate] = useState<string | undefined>();
  const [customerPriceMap, setCustomerPriceMap] = useState<Record<number, PriceHint>>({});
  const [lastSOModalOpen, setLastSOModalOpen] = useState(false);
  const [lastSOItems, setLastSOItems] = useState<Item[]>([]);
  const [selectedLastItems, setSelectedLastItems] = useState<Set<number>>(new Set());
  const [commonModalOpen, setCommonModalOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [soDataLoaded, setSoDataLoaded] = useState(false);
  const [productSelectionModalOpen, setProductSelectionModalOpen] = useState(false);
  const [activeRowKeyForProductSelect, setActiveRowKeyForProductSelect] = useState<string | undefined>();

  const canCreateFGKit = useMemo(() => {
    return me?.role === 'admin' || me?.role === 'supervisor';
  }, [me?.role]);

  useEffect(() => {
    (async () => {
      // 傳遞較大的 limit 以獲取所有產品（後端最大限制是 500，但我們傳 1000 讓後端處理）
      const ps = await api.listProducts({ limit: 1000 });
      setProducts(ps);

      const inv = await api.listInventory({});
      const m: Record<number, number> = {};
      inv.forEach((r: any) => { m[r.product_id] = r.current_stock; });
      setStockMap(m);

      const cs = await api.listCustomers({});
      // 只显示启用的客户
      setCustomers(cs.filter((c: Customer) => c.is_active));
    })();
  }, []);

  // 載入現有銷貨單資料（編輯模式）- 需要等待 products 和 customers 載入完成
  useEffect(() => {
    // 如果不是編輯模式，重置標記
    if (!isEditMode) {
      setSoDataLoaded(false);
      return;
    }
    if (!isEditMode || !soId || products.length === 0 || customers.length === 0 || soDataLoaded) return;
    
    (async () => {
      try {
        setLoading(true);
        const so = await api.getSO(soId);
        
        // 檢查狀態，只有 DRAFT 可以編輯
        if (so.status !== 'DRAFT') {
          message.error(`只有待出貨狀態的銷貨單可以編輯，目前狀態：${so.status}`);
          nav('/sales-orders');
          return;
        }
        
        // 設置表單資料 - 使用 setTimeout 確保表單已經渲染完成
        setTimeout(() => {
          // 查找客戶資訊以獲取地址和電話
          const selectedCustomer = customers.find(c => c.name === so.customer_name);
          
          formRef.current?.setFieldsValue({
            customer_name: so.customer_name,
            customer_address: selectedCustomer?.address || so.customer_address || '',
            customer_phone: selectedCustomer?.phone || so.customer_phone || '',
            doc_date: so.doc_date ? (typeof so.doc_date === 'string' ? so.doc_date.split('T')[0] : so.doc_date) : undefined,
            note: so.note || '',
          });
          
          // 如果找到了客戶，載入常用品項價格提示
          if (selectedCustomer) {
            (async () => {
              try {
                const commonItems = await api.commonSOItems(so.customer_name);
                const priceMap: Record<number, PriceHint> = {};
                commonItems.forEach((item: any) => {
                  priceMap[item.product_id] = {
                    unit_price: item.last_unit_price,
                    price_unit: item.last_price_unit,
                  };
                });
                setCustomerPriceMap(priceMap);
              } catch (e: any) {
                console.error('Failed to load common items for price hints:', e);
                setCustomerPriceMap({});
              }
            })();
          }
        }, 100);
        
        // 設置明細資料
        const soItems: Item[] = so.items.map((it: any, idx: number) => ({
          id: idx + 1,
          product_id: it.product_id,
          qty: it.qty,
          case_qty: it.qty,
          unit: it.unit,
          price_unit: it.price_unit,
          unit_price: it.unit_price,
          note: it.note || '',
          mark: it.mark || '',
        }));
        setItems(soItems);
        setEditableKeys(soItems.map((_, idx) => idx + 1));
        setSelectedCustomerName(so.customer_name);
        setSoDataLoaded(true);
      } catch (e: any) {
        message.error(`載入銷貨單失敗：${e?.message || '未知錯誤'}`);
        nav('/sales-orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditMode, soId, products, customers, soDataLoaded, nav, message]);

  // 銷貨單：不能選 RAW（只能選 FG 和 TRADE）
  const saleProducts = useMemo(
    () => products.filter(p => (p.product_type === 'FG' || p.product_type === 'TRADE') && p.is_active !== false),
    [products],
  );
  
  // 收集所有商品的報價單位作為選項
  const priceUnitOptions = useMemo(() => {
    const units = new Set<string>();
    saleProducts.forEach(p => {
      if (p.quotation_unit) {
        units.add(p.quotation_unit);
      }
    });
    // 添加常見的單位
    ['件', '包', '箱', '盒', '袋', '組', '打', '個'].forEach(u => units.add(u));
    return Array.from(units).sort().map(u => ({ label: u, value: u }));
  }, [saleProducts]);

  const refreshProducts = async () => {
    const ps = await api.listProducts({});
    setProducts(ps);
  };

  const handleFGKitCreated = async (productId: number) => {
    // 刷新产品列表
    const updatedProducts = await api.listProducts({});
    setProducts(updatedProducts);
    
    // 如果有关联的行，更新该行的 product_id 和 unit
    if (activeRowKeyForCreate) {
      const newProduct = updatedProducts.find((p: Product) => p.id === productId);
      
      setItems((prev) =>
        prev.map((item) => {
          if (String(item.id) === activeRowKeyForCreate) {
            return { 
              ...item, 
              product_id: productId,
              unit: getProductUnit(newProduct) || item.unit || '個'
            };
          }
          return item;
        })
      );
      setActiveRowKeyForCreate(undefined);
    }
  };

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
      valueType: 'text',
      width: 300,
      renderFormItem: (_, { record, isEditable }) => {
        if (!isEditable) return null;
        const p = saleProducts.find(p => p.id === record?.product_id);
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
      render: (_, row) => {
        const p = saleProducts.find(p => p.id === row.product_id);
        if (!p) return '-';
        // 顯示格式：[ 類別 ] 規格 包裝 包裝膜
        // 如果產品名稱已經包含完整格式，直接使用；否則組合顯示
        let displayName = p.name;
        if (p.brand && !displayName.includes(p.brand)) {
          displayName = `${displayName} ${p.brand}`;
        }
        return (
          <div style={{ 
            whiteSpace: 'normal', 
            wordBreak: 'break-word',
            lineHeight: '1.5',
          }}>
            {displayName}
          </div>
        );
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
      render: (_, row) => {
        const p = saleProducts.find(p => p.id === row.product_id);
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
      fieldProps: {
        precision: 2,
        prefix: 'NT$',
      },
      width: 100,
      render: (_, row) => {
        const price = Number(row.unit_price || 0);
        return price > 0 ? `NT$${price.toFixed(2)}` : '-';
      },
    },
    {
      title: '小計',
      dataIndex: 'subtotal',
      editable: false,
      width: 100,
      render: (_, row) => {
        const caseQty = Number(row.case_qty || row.qty || 0);
        const price = Number(row.unit_price || 0);
        const subtotal = (caseQty * price).toFixed(2);
        return `NT$${subtotal}`;
      },
    },
    { 
      title: '備註', 
      dataIndex: 'note',
      width: 150,
    },
  ];

  return (
    <>
      <style>{`
        .product-select-dropdown .ant-select-item-option-content {
          white-space: normal !important;
          word-break: break-word !important;
          line-height: 1.5 !important;
          padding: 4px 0 !important;
        }
        .product-select-dropdown .ant-select-item {
          padding: 8px 12px !important;
          min-height: auto !important;
          height: auto !important;
        }
      `}</style>
      <Card 
        title={isEditMode ? "編輯銷貨單" : "建立銷貨單"} 
        loading={loading}
        extra={<Button onClick={() => nav('/sales-orders')}>返回</Button>}
      >
      <ProForm
        formRef={formRef}
        onFinish={async (v) => {
          if (!items.length) return message.error('請至少一筆明細'), false;
          if (items.some(x => !x.product_id)) return message.error('明細商品未選'), false;

          // 檢查庫存不足，但只提醒不阻止
          const lowStockItems: string[] = [];
          items.forEach(it => {
            if (it.product_id) {
              const stock = stockMap[it.product_id] ?? 0;
              const qty = Number(it.case_qty || it.qty || 0);
              if (qty > stock) {
                const product = saleProducts.find(p => p.id === it.product_id);
                const productName = product ? (product.sku ? `${product.sku} ${product.name}` : product.name) : `商品 #${it.product_id}`;
                lowStockItems.push(`${productName}（庫存：${stock}，需求：${qty}）`);
              }
            }
          });
          
          if (lowStockItems.length > 0) {
            message.warning(`以下商品庫存不足：${lowStockItems.join('；')}，但仍可建立銷貨單`, 5);
          }

          try {
            const payload = {
              customer_name: (v.customer_name || '').trim(),
              doc_date: v.doc_date,
              note: v.note,
              items: items.map(({ id, ...rest }) => ({
                ...rest,
                qty: Number(rest.case_qty || rest.qty || 0),
                unit_price: Number(rest.unit_price || 0),
                price_unit: rest.price_unit || '件',
              })),
            };
            
            if (isEditMode && soId) {
              await api.updateSO(soId, payload);
              message.success('已更新銷貨單（庫存已重新計算）');
            } else {
              await api.createSO(payload);
              message.success('已建立銷貨單（庫存已扣除）');
            }
            nav('/sales-orders');
            return true;
          } catch (e: any) {
            // 後端錯誤處理：如果是庫存不足，只提醒不阻止（但後端可能已經阻止了）
            const errorMsg = e?.message || '建立失敗';
            if (errorMsg.includes('庫存') || errorMsg.includes('stock') || errorMsg.includes('不足')) {
              message.warning(`建立銷貨單時庫存不足：${errorMsg}，請確認庫存後再試`, 5);
            } else {
              message.error(`建立失敗：${errorMsg}`);
            }
            return false;
          }
        }}
        submitter={{
          render: (_, dom) => (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => nav('/sales-orders')}>取消</Button>
              {dom}
            </div>
          ),
        }}
      >
        <div style={{ border: '1px solid #d9d9d9', padding: '16px', marginBottom: '16px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
          <ProFormSelect
            name="customer_name"
            label="客戶名稱"
            rules={[{ required: true }]}
            valueType="select"
            fieldProps={{
              showSearch: true,
              placeholder: '請選擇或輸入關鍵字搜尋客戶',
              filterOption: (input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              onChange: async (value: string) => {
                const cname = value?.trim();
                if (cname) {
                  // 更新客戶資訊顯示
                  const selectedCustomer = customers.find(c => c.name === cname);
                  if (selectedCustomer) {
                    formRef.current?.setFieldsValue({
                      customer_address: selectedCustomer.address || '',
                      customer_phone: selectedCustomer.phone || '',
                    });
                  }
                  // 載入常用品項價格提示
                  try {
                    console.log('Loading common items for price hints, customer:', cname);
                    const commonItems = await api.commonSOItems(cname);
                    const priceMap: Record<number, PriceHint> = {};
                    commonItems.forEach((item: any) => {
                      priceMap[item.product_id] = {
                        unit_price: item.last_unit_price,
                        price_unit: item.last_price_unit,
                      };
                    });
                    setCustomerPriceMap(priceMap);
                  } catch (e: any) {
                    console.error('Failed to load common items for price hints:', e);
                    setCustomerPriceMap({});
                  }
                } else {
                  setCustomerPriceMap({});
                }
              },
              onBlur: async (e: any) => {
                const cname = e?.target?.value?.trim();
                if (cname) {
                  try {
                    const commonItems = await api.commonSOItems(cname);
                    const priceMap: Record<number, PriceHint> = {};
                    commonItems.forEach((item: any) => {
                      priceMap[item.product_id] = {
                        unit_price: item.last_unit_price,
                        price_unit: item.last_price_unit,
                      };
                    });
                    setCustomerPriceMap(priceMap);
                  } catch (e: any) {
                    setCustomerPriceMap({});
                  }
                }
              },
            }}
            options={customers.map(c => ({
              label: c.name,
              value: c.name,
            }))}
          />
          <ProFormText
            name="customer_address"
            label="送貨地址"
            placeholder="自動帶入客戶地址"
            fieldProps={{
              readOnly: true,
              style: { backgroundColor: '#f5f5f5' }
            }}
            style={{ marginTop: 8, width: '100%' }}
          />
          <ProFormText
            name="customer_phone"
            label="聯繫電話"
            placeholder="自動帶入客戶電話"
            fieldProps={{
              readOnly: true,
              style: { backgroundColor: '#f5f5f5' }
            }}
            style={{ marginTop: 8, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Button
            type="default"
            onClick={async () => {
              const formValues = formRef.current?.getFieldsValue();
              const cname = formValues?.customer_name?.toString()?.trim();
              if (!cname) {
                message.warning('請先選擇客戶');
                return;
              }
              setSelectedCustomerName(cname);
              setCommonModalOpen(true);
            }}
          >
            常用品項
          </Button>
          <Button
            type="default"
            onClick={async () => {
              const formValues = formRef.current?.getFieldsValue();
              const cname = formValues?.customer_name?.toString()?.trim();
              if (!cname) {
                message.warning('請先選擇客戶');
                return;
              }
              try {
                const lastSO = await api.lastSO(cname);
                const lastItems: Item[] = (lastSO.items || []).map((it: any, idx: number) => ({
                  id: Date.now() + idx,
                  product_id: it.product_id,
                  qty: it.qty,
                  unit: it.unit,
                  price_unit: it.price_unit || it.unit || '件',
                  unit_price: it.unit_price || 0,
                  note: it.note,
                }));
                setLastSOItems(lastItems);
                setSelectedLastItems(new Set(lastItems.map((_, idx) => idx)));
                setLastSOModalOpen(true);
              } catch (e: any) {
                console.error('Failed to load last SO:', e);
                // 404 可能是沒有歷史訂單，或者是路由問題
                const errorMsg = e?.message?.includes('找不到') || e?.message?.includes('404') 
                  ? '找不到該客戶的歷史訂單' 
                  : '載入歷史訂單失敗，請確認後端服務器已重啟';
                message.error(errorMsg);
              }
            }}
          >
            帶入最近一次
          </Button>
        </div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
          歷史帶入依客戶名稱完全匹配
        </div>
        <ProFormDatePicker name="doc_date" label="出貨日期" />
        <ProFormText name="note" label="備註" />

        <Divider />

        <EditableProTable<Item>
          rowKey="id"
          headerTitle="銷貨明細（估價/出貨單格式）"
          value={items}
          scroll={{ x: 'max-content' }}
          onChange={(v) => {
            if (!v || !Array.isArray(v)) {
              return;
            }
            const next = v
              .filter(row => row != null) // 過濾掉 null/undefined
              .map(row => {
                // 確保每行都有 id
                if (!row.id) {
                  row.id = Date.now() + Math.random();
                }
                // 保留原有的 product_id，不要重置
                const existingItem = items.find(item => item.id === row.id);
                const productId = row.product_id ?? existingItem?.product_id;
                
                const p = saleProducts.find(p => p.id === productId);
                // 當 product_id 變更時，自動更新 unit、unit_price 和 price_unit
                const hint = customerPriceMap[productId ?? 0];
                const newUnit = getProductUnit(p) || row.unit || existingItem?.unit || '個';
                // 如果 price_unit 還沒有設置或是預設值 '件'，自動帶入商品的 quotation_unit（但可以編輯）
                const currentPriceUnit = row.price_unit ?? existingItem?.price_unit;
                const isDefaultValue = !currentPriceUnit || currentPriceUnit === '' || currentPriceUnit === '件';
                const newPriceUnit = isDefaultValue 
                  ? (hint?.price_unit || p?.quotation_unit || '件')
                  : currentPriceUnit;
                // 如果沒有 case_qty，使用 qty
                if (!row.case_qty && row.qty) {
                  row.case_qty = row.qty;
                }
                return {
                  ...row,
                  product_id: productId, // 確保保留 product_id
                  unit: newUnit,
                  price_unit: newPriceUnit,
                  unit_price: row.unit_price ?? existingItem?.unit_price ?? (hint?.unit_price ?? 0),
                  case_qty: row.case_qty || row.qty || existingItem?.case_qty || 0,
                };
              });
            setItems(next);
          }}
          columns={columns}
          recordCreatorProps={{
            position: 'bottom',
            newRecordType: 'dataSource',
            record: () => ({ id: Date.now(), qty: 1, case_qty: 1, unit: '個', price_unit: '件', unit_price: 0 }),
          }}
          summary={() => {
            const totalCaseQty = items.reduce((sum, it) => sum + Number(it.case_qty || it.qty || 0), 0);
            const totalAmount = items.reduce((sum, it) => {
              const caseQty = Number(it.case_qty || it.qty || 0);
              const price = Number(it.unit_price || 0);
              return sum + (caseQty * price);
            }, 0);
            const priceUnit = items[0]?.price_unit || '件';
            
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6} align="left">
                    <span style={{ fontWeight: 700 }}>總件數：{totalCaseQty}{priceUnit}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} colSpan={3} align="right">
                    <span style={{ fontWeight: 700 }}>銷貨總金額：NT${totalAmount.toFixed(2)}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
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
              
              // 確保 record 有 id，如果沒有則生成一個
              const recordId = record.id || Date.now() + Math.random();
              
              // 獲取當前行的原始數據，用於保留未變更的字段
              const existingItem = items.find(item => item.id === recordId);
              
              // 當 product_id 變更時，自動更新該行的 unit、unit_price 和 price_unit
              const updated = recordList
                .filter(row => row != null) // 過濾掉 undefined 或 null 的行
                .map(row => {
                  // 確保 row 有 id，如果沒有則生成一個
                  const rowId = row.id || Date.now() + Math.random();
                  const existingRow = items.find(item => item.id === rowId);
                  const rowWithId = { ...row, id: rowId };
                  
                  // 如果是當前編輯的行
                  if (rowId === recordId) {
                    // 如果 product_id 變更了，更新相關字段
                    if (record.product_id !== undefined && record.product_id !== existingItem?.product_id) {
                      const p = saleProducts.find(p => p.id === record.product_id);
                      const hint = customerPriceMap[record.product_id];
                      const newUnit = getProductUnit(p) || rowWithId.unit || '個';
                      // 當選擇商品時，如果 price_unit 還沒有被手動設置過，則自動帶入商品的 quotation_unit
                      const currentPriceUnit = rowWithId.price_unit;
                      // 檢查是否是初始狀態（空、undefined、null 或預設值 '件'）
                      const isInitialState = !currentPriceUnit || currentPriceUnit === '' || currentPriceUnit === '件';
                      // 優先使用 hint 的 price_unit，其次使用商品的 quotation_unit
                      const autoPriceUnit = hint?.price_unit || p?.quotation_unit;
                      // 如果商品有報價單位且是初始狀態，則使用商品的報價單位
                      const newPriceUnit = (isInitialState && autoPriceUnit)
                        ? autoPriceUnit
                        : (currentPriceUnit || autoPriceUnit || '件');
                      return {
                        ...rowWithId,
                        product_id: record.product_id,
                        unit: newUnit,
                        price_unit: newPriceUnit,
                        unit_price: hint?.unit_price != null ? hint.unit_price : (rowWithId.unit_price || 0),
                        case_qty: rowWithId.case_qty || rowWithId.qty || 0,
                      };
                    }
                    // 如果 product_id 沒有變更，保留原有的 product_id
                    const preservedProductId = record.product_id !== undefined 
                      ? record.product_id 
                      : (existingItem?.product_id ?? rowWithId.product_id);
                    
                    // 當 unit 變更時，若 price_unit 為空 → price_unit = unit
                    if (record.unit !== undefined && !rowWithId.price_unit) {
                      return {
                        ...rowWithId,
                        product_id: preservedProductId, // 保留 product_id
                        price_unit: record.unit,
                      };
                    }
                    // 當 case_qty 變更時，同步更新 qty
                    if (record.case_qty !== undefined) {
                      return {
                        ...rowWithId,
                        product_id: preservedProductId, // 保留 product_id
                        qty: record.case_qty,
                      };
                    }
                    // 其他字段變更時，保留 product_id
                    return {
                      ...rowWithId,
                      product_id: preservedProductId, // 保留 product_id
                    };
                  }
                  // 其他行保持不變，但確保有 product_id
                  return {
                    ...rowWithId,
                    product_id: rowWithId.product_id ?? existingRow?.product_id,
                  };
                });
              setItems(updated);
            },
          }}
        />
      </ProForm>

      <CreateFGKitModal
        open={fgKitModalOpen}
        onCancel={() => {
          setFgKitModalOpen(false);
          setActiveRowKeyForCreate(undefined);
        }}
        onCreated={handleFGKitCreated}
      />

      <Modal
        title="帶入最近一次訂單"
        open={lastSOModalOpen}
        onOk={() => {
          const selectedItems = lastSOItems.filter((_, idx) => selectedLastItems.has(idx));
          if (selectedItems.length === 0) {
            message.warning('請至少選擇一項');
            return;
          }

          // 合併規則：同 product_id 已存在：qty 相加；unit_price 和 price_unit 用「帶入的」覆蓋
          const existingItems = [...items];
          const newItems: Item[] = [];
          const warnings: string[] = [];

          selectedItems.forEach(selectedItem => {
            const existingIdx = existingItems.findIndex(
              item => item.product_id === selectedItem.product_id
            );
            if (existingIdx >= 0) {
              const existing = existingItems[existingIdx];
              const existingPriceUnit = existing.price_unit || existing.unit || '件';
              const importedPriceUnit = selectedItem.price_unit || selectedItem.unit || '件';
              
              // 如果 price_unit 不同，顯示提示
              if (existingPriceUnit !== importedPriceUnit) {
                warnings.push(`商品 #${selectedItem.product_id}：現有報價單位=${existingPriceUnit}，帶入的報價單位=${importedPriceUnit}`);
              }
              
              // 同 product_id 已存在：qty 相加；unit_price 和 price_unit 用「帶入的」覆蓋
              existingItems[existingIdx] = {
                ...existing,
                qty: (existing.qty || 0) + (selectedItem.qty || 0),
                unit_price: selectedItem.unit_price || 0,
                price_unit: importedPriceUnit,
              };
            } else {
              // 不存在：新增一列
              newItems.push({
                ...selectedItem,
                id: Date.now() + Math.random(),
              });
            }
          });

          if (warnings.length > 0) {
            message.warning(`報價單位不一致：${warnings.join('；')}`, 5);
          }

          setItems([...existingItems, ...newItems]);
          setLastSOModalOpen(false);
          setLastSOItems([]);
          setSelectedLastItems(new Set());
          message.success(`已帶入 ${selectedItems.length} 項商品`);
        }}
        onCancel={() => {
          setLastSOModalOpen(false);
          setLastSOItems([]);
          setSelectedLastItems(new Set());
        }}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={selectedLastItems.size === lastSOItems.length && lastSOItems.length > 0}
            indeterminate={
              selectedLastItems.size > 0 && selectedLastItems.size < lastSOItems.length
            }
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedLastItems(new Set(lastSOItems.map((_, idx) => idx)));
              } else {
                setSelectedLastItems(new Set());
              }
            }}
          >
            全選
          </Checkbox>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {lastSOItems.map((item, idx) => {
            const p = saleProducts.find(p => p.id === item.product_id);
            return (
              <div
                key={idx}
                style={{
                  padding: 8,
                  border: '1px solid #d9d9d9',
                  marginBottom: 8,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Checkbox
                  checked={selectedLastItems.has(idx)}
                  onChange={(e) => {
                    const newSet = new Set(selectedLastItems);
                    if (e.target.checked) {
                      newSet.add(idx);
                    } else {
                      newSet.delete(idx);
                    }
                    setSelectedLastItems(newSet);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {p?.sku ? `${p.sku} - ` : ''}
                    {p?.name || `商品 #${item.product_id}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    數量: {item.qty} {item.unit || '個'} | 單價: {item.unit_price || 0} | 報價單位: {item.price_unit || item.unit || '件'} | 小計:{' '}
                    {((item.qty || 0) * (item.unit_price || 0)).toFixed(2)}
                  </div>
                  {item.note && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      備註: {item.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <PickCommonItemsModal
        open={commonModalOpen}
        customerName={selectedCustomerName}
        onClose={() => {
          setCommonModalOpen(false);
          setSelectedCustomerName('');
        }}
        onApply={(picked) => {
          // 合併到 items
          setItems((prev) => {
            const next = [...prev];

            picked.forEach((p) => {
              // qty=0 的列就不帶（避免帶一堆空列）
              const caseQty = Number((p.case_qty || p.qty) ?? 0);
              if (!p.product_id || caseQty <= 0) return;

              const idx = next.findIndex((x) => x.product_id === p.product_id);
              if (idx >= 0) {
                // 合併：qty 相加、單價/報價單位覆蓋（最近成交）
                const old = next[idx];

                // 若 price_unit 不同，提示但不擋
                if (old.price_unit && p.price_unit && old.price_unit !== p.price_unit) {
                  message.warning(`注意：同商品報價單位不一致（${old.price_unit} → ${p.price_unit}）已以帶入為準`);
                }

                const oldCaseQty = Number((old.case_qty || old.qty) ?? 0);
                next[idx] = {
                  ...old,
                  qty: Number(old.qty ?? 0) + Number(p.qty ?? 0),
                  case_qty: oldCaseQty + caseQty,
                  unit_price: Number(p.unit_price ?? 0),
                  price_unit: (p.price_unit || old.price_unit || old.unit || '件').trim() || '件',
                  mark: p.mark || old.mark || '',
                  note: p.note || old.note || '',
                };
              } else {
                // 新增一列：unit 會在你既有的 onValuesChange/product_id change 裡自動補齊
                next.push({
                  id: Date.now() + Math.floor(Math.random() * 1000),
                  product_id: p.product_id,
                  qty: caseQty,
                  case_qty: caseQty,
                  unit_price: Number(p.unit_price ?? 0),
                  price_unit: (p.price_unit || '件').trim() || '件',
                  mark: p.mark || '',
                  note: p.note || '',
                } as any);
              }
            });

            return next;
          });
        }}
      />

      <ProductSelectionModal
        open={productSelectionModalOpen}
        products={saleProducts}
        onClose={() => {
          setProductSelectionModalOpen(false);
          setActiveRowKeyForProductSelect(undefined);
        }}
        onSelect={(productId) => {
          if (activeRowKeyForProductSelect) {
            setItems((prev) =>
              prev.map((item) => {
                if (String(item.id) === activeRowKeyForProductSelect) {
                  const selectedProduct = saleProducts.find(p => p.id === productId);
                  const hint = customerPriceMap[productId];
                  return {
                    ...item,
                    product_id: productId,
                    unit: getProductUnit(selectedProduct) || item.unit || '個',
                    price_unit: hint?.price_unit || selectedProduct?.quotation_unit || item.price_unit || '件',
                    unit_price: hint?.unit_price != null ? hint.unit_price : (item.unit_price || 0),
                  };
                }
                return item;
              })
            );
          }
          setProductSelectionModalOpen(false);
          setActiveRowKeyForProductSelect(undefined);
        }}
      />
      </Card>
    </>
  );
}

