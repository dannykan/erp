import React, { useEffect, useState, useMemo } from 'react';
import { ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormSwitch } from '@ant-design/pro-components';
import { Button, Card, Divider, message } from 'antd';
import { EditableProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

type Item = {
  id: number;
  product_id?: number; // 用于选择商品
  product_name: string;
  spec?: string;
  packaging?: string;
  qty: number;
  unit?: string;
  cartons?: number;
  per_carton?: number;
  note?: string;
};

type Customer = {
  id: number;
  name: string;
  is_active: boolean;
};

type Product = {
  id: number;
  sku?: string;
  name: string;
  spec?: string;
  unit: string;
  is_active: boolean;
};

type OrderItem = {
  product_name: string;
  spec?: string;
  packaging?: string;
};

export default function NewOrder() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editableKeys, setEditableKeys] = useState<React.Key[]>([]);
  const [historicalSpecs, setHistoricalSpecs] = useState<Set<string>>(new Set());
  const [historicalPackagings, setHistoricalPackagings] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const cs = await api.listCustomers({});
        // 只显示启用的客户
        setCustomers(Array.isArray(cs) ? cs.filter((c: Customer) => c.is_active) : []);
        
        // 获取商品列表
        const ps = await api.listProducts({});
        const productsList = Array.isArray(ps) ? ps : [];
        console.log('Loaded products:', productsList);
        // 過濾啟用的商品（is_active 為 true 或 undefined/null 都視為啟用）
        const activeProducts = productsList.filter((p: Product) => p.is_active !== false);
        console.log('Active products:', activeProducts);
        setProducts(activeProducts);
      } catch (e) {
        console.error('Failed to load customers or products:', e);
        message.error('載入客戶或商品列表失敗');
      }
      
      // 获取历史订单数据，用于填充规格和包装的下拉选单
      try {
        const orders = await api.listOrders();
        const specs = new Set<string>();
        const packagings = new Set<string>();
        if (Array.isArray(orders)) {
          orders.forEach((order: any) => {
            order.items?.forEach((item: OrderItem) => {
              if (item.spec) specs.add(item.spec);
              if (item.packaging) packagings.add(item.packaging);
            });
          });
        }
        setHistoricalSpecs(specs);
        setHistoricalPackagings(packagings);
      } catch (e) {
        console.error('Failed to load historical orders:', e);
      }
    })();
  }, []);

  const columns: ProColumns<Item>[] = useMemo(() => [
    {
      title: '品名',
      dataIndex: 'product_id',
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        placeholder: '請選擇商品 Q',
        allowClear: true,
        options: products.map(p => ({
          label: `${p.sku ? p.sku + ' - ' : ''}${p.name}`,
          value: p.id,
        })),
        filterOption: (input: string, option: any) => {
          const label = option?.label ?? '';
          return label.toLowerCase().includes(input.toLowerCase());
        },
      },
      render: (_, record) => {
        if (record.product_id) {
          const product = products.find(p => p.id === record.product_id);
          return product ? `${product.sku ? product.sku + ' - ' : ''}${product.name}` : '';
        }
        return record.product_name || '';
      },
    },
    {
      title: '規格',
      dataIndex: 'spec',
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        allowClear: true,
        placeholder: '請選擇或輸入規格',
        filterOption: false, // 允许输入新值
        notFoundContent: null,
      },
      options: Array.from(historicalSpecs).map(s => ({ label: s, value: s })),
    },
    {
      title: '包裝',
      dataIndex: 'packaging',
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        allowClear: true,
        placeholder: '請選擇或輸入包裝',
        filterOption: false, // 允许输入新值
        notFoundContent: null,
      },
      options: Array.from(historicalPackagings).map(p => ({ label: p, value: p })),
    },
    { title: '數量', dataIndex: 'qty', valueType: 'digit' },
    { title: '單位', dataIndex: 'unit' },
    { title: '箱數', dataIndex: 'cartons', valueType: 'digit' },
    { title: '每箱', dataIndex: 'per_carton', valueType: 'digit' },
    { title: '備註', dataIndex: 'note' },
    { title: '操作', valueType: 'option' }
  ], [products, historicalSpecs, historicalPackagings]);

  return (
    <Card title="新增訂單">
      <ProForm
        submitter={{
          render: (_, dom) => (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => nav('/orders')}>取消</Button>
              {dom}
            </div>
          ),
        }}
        onFinish={async (v) => {
          if (!items.length) {
            message.error('請至少新增一筆明細');
            return false;
          }
          try {
            await api.createOrder({
              customer_name: v.customer_name,
              due_date: v.due_date,
              urgent: !!v.urgent,
              note: v.note,
              items: items.map(({ id, product_id, ...rest }) => ({
                ...rest,
                product_name: rest.product_name || '',
              })),
            });
            message.success('已建立訂單');
            nav('/orders');
            return true;
          } catch {
            message.error('建立失敗（請確認後端）');
            return false;
          }
        }}
      >
        <ProFormSelect
          name="customer_name"
          label="客戶"
          rules={[{ required: true }]}
          valueType="select"
          fieldProps={{
            showSearch: true,
            placeholder: '請選擇或輸入關鍵字搜尋客戶',
            filterOption: (input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
          options={customers.map(c => ({
            label: c.name,
            value: c.name,
          }))}
        />
        <ProFormDatePicker name="due_date" label="交期" />
        <ProFormSwitch name="urgent" label="急件" />
        <ProFormText name="note" label="備註" />

        <Divider />

        <EditableProTable<Item>
          rowKey="id"
          headerTitle="明細"
          value={items}
          onChange={(newItems) => {
            // 当商品选择改变时，自动更新品名和规格
            const updated = newItems.map(item => {
              if (item.product_id) {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                  return {
                    ...item,
                    product_name: product.name,
                    spec: item.spec || product.spec || '',
                  };
                }
              }
              return item;
            });
            setItems(updated);
          }}
          columns={columns}
          recordCreatorProps={{
            position: 'bottom',
            record: () => ({ id: Date.now(), product_name: '', qty: 1, unit: '包' }),
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onChange: setEditableKeys,
            onSave: async (rowKey, data, row) => {
              // 当保存时，如果选择了商品，确保品名已填充
              if (data.product_id) {
                const product = products.find(p => p.id === data.product_id);
                if (product) {
                  const updated = items.map(item => {
                    if (item.id === row.id) {
                      return {
                        ...item,
                        product_id: data.product_id,
                        product_name: product.name,
                        spec: item.spec || product.spec || data.spec || '',
                      };
                    }
                    return item;
                  });
                  setItems(updated);
                }
              }
              return true;
            },
          }}
        />
      </ProForm>
    </Card>
  );
}

