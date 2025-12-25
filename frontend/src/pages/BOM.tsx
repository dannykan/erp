import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Button, Table, Space, message, Select, Popconfirm } from 'antd';
import { api } from '../app/api';

type BomItem = {
  id: number;
  fg_product_id: number;
  raw_product_id: number;
  raw_product_name?: string;
  raw_product_sku?: string;
  qty_per_fg_unit: number;
  note?: string;
  is_active: boolean;
  created_at: string;
};

type Product = {
  id: number;
  sku?: string;
  name: string;
  spec?: string;
  product_type: string;
  base_unit?: string;
};

export default function BOM() {
  const { fgProductId } = useParams<{ fgProductId: string }>();
  const navigate = useNavigate();
  const [fgProduct, setFgProduct] = useState<Product | null>(null);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!fgProductId) {
      message.error('缺少成品 ID');
      navigate('/products');
      return;
    }
    loadData();
  }, [fgProductId]);

  // 從產品名稱中提取最後的數字X數字模式（例如：100X27），計算乘積
  const calculateQtyFromProductName = (productName: string): number | null => {
    if (!productName) return null;
    
    // 匹配所有的 數字X數字 模式（不區分大小寫，支持 X, x, ×）
    // 例如：100X27, 100x27, 50×70 等
    const matches = productName.matchAll(/(\d+)\s*[Xx×]\s*(\d+)/g);
    const allMatches = Array.from(matches);
    
    // 取最後一個匹配（如果有多個）
    if (allMatches.length > 0) {
      const lastMatch = allMatches[allMatches.length - 1];
      const num1 = parseInt(lastMatch[1], 10);
      const num2 = parseInt(lastMatch[2], 10);
      if (!isNaN(num1) && !isNaN(num2)) {
        return num1 * num2;
      }
    }
    return null;
  };

  const loadData = async () => {
    if (!fgProductId) return;
    setLoading(true);
    try {
      // 載入 FG 商品資訊
      const products = await api.listProducts({});
      const fg = products.find((p: Product) => p.id === Number(fgProductId));
      if (!fg || fg.product_type !== 'FG') {
        message.error('找不到成品或該商品不是 FG 類型');
        navigate('/products');
        return;
      }
      setFgProduct(fg);

      // 載入 RAW 商品列表（供選擇）
      const rawList = products.filter((p: Product) => p.product_type === 'RAW');
      setRawProducts(rawList);

      // 載入 BOM
      const bom = await api.getBOM(Number(fgProductId));
      setBomItems(bom);
    } catch (e: any) {
      message.error('載入失敗：' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const items = values.items || [];
      
      if (items.length === 0) {
        message.warning('至少需要一個 BOM 項目');
        return;
      }

      // 檢查是否有重複的 raw_product_id
      const rawIds = items.map((it: any) => it.raw_product_id);
      if (new Set(rawIds).size !== rawIds.length) {
        message.error('不能有重複的原料');
        return;
      }

      await api.upsertBOM(Number(fgProductId!), {
        items: items.map((it: any) => ({
          raw_product_id: it.raw_product_id,
          qty_per_fg_unit: Number(it.qty_per_fg_unit),
          note: it.note || undefined,
        })),
      });

      message.success('已儲存 BOM');
      loadData();
      form.resetFields();
    } catch (e: any) {
      message.error('儲存失敗：' + (e.message || String(e)));
    }
  };

  const columns = [
    {
      title: '原料品號',
      dataIndex: 'raw_product_sku',
      key: 'raw_product_sku',
      render: (text: string) => text || '-',
    },
    {
      title: '原料名稱',
      dataIndex: 'raw_product_name',
      key: 'raw_product_name',
    },
    {
      title: '每件用量',
      dataIndex: 'qty_per_fg_unit',
      key: 'qty_per_fg_unit',
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: '備註',
      dataIndex: 'note',
      key: 'note',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <Button onClick={() => navigate('/products')}>← 返回商品列表</Button>
            <span>
              BOM 管理：{fgProduct ? `${fgProduct.sku || ''} ${fgProduct.name}` : '載入中...'}
            </span>
          </Space>
        }
        loading={loading}
      >
        <div style={{ marginBottom: 24 }}>
          <h3>現有 BOM 項目</h3>
          <Table
            dataSource={bomItems}
            columns={columns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: '尚無 BOM 項目' }}
          />
        </div>

        <div style={{ marginTop: 32 }}>
          <h3>編輯 BOM（整包覆蓋）</h3>
          <Form form={form} layout="vertical">
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...field}
                        name={[field.name, 'raw_product_id']}
                        label={index === 0 ? '原料' : ''}
                        rules={[{ required: true, message: '請選擇原料' }]}
                        style={{ width: 250 }}
                      >
                        <Select
                          placeholder="選擇原料"
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={rawProducts.map((p) => ({
                            value: p.id,
                            label: `${p.sku || ''} ${p.name}`.trim(),
                          }))}
                          onChange={(value) => {
                            // 當選擇原料時，自動計算並填充每件用量
                            if (fgProduct && value) {
                              const calculatedQty = calculateQtyFromProductName(fgProduct.name);
                              if (calculatedQty !== null) {
                                form.setFieldValue(['items', field.name, 'qty_per_fg_unit'], calculatedQty);
                              }
                            }
                          }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'qty_per_fg_unit']}
                        label={index === 0 ? '每件用量' : ''}
                        rules={[
                          { required: true, message: '請輸入用量' },
                          { type: 'number', min: 0.0001, message: '用量必須 > 0' },
                        ]}
                        style={{ width: 150 }}
                      >
                        <InputNumber
                          placeholder="例如: 2400"
                          style={{ width: '100%' }}
                          precision={2}
                          min={0.0001}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'note']}
                        label={index === 0 ? '備註' : ''}
                        style={{ width: 200 }}
                      >
                        <Input placeholder="例如: 裸筷（雙）" />
                      </Form.Item>
                      <Button
                        type="link"
                        danger
                        onClick={() => remove(field.name)}
                        style={{ marginTop: index === 0 ? 32 : 0 }}
                      >
                        刪除
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block>
                      + 新增項目
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleSave}>
                  儲存 BOM
                </Button>
                <Button onClick={() => form.resetFields()}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <h4>說明</h4>
          <ul>
            <li>BOM（Bill of Materials）定義了生產 1 件成品需要消耗多少原料</li>
            <li>「每件用量」以原料的 base_unit 為單位</li>
            <li>儲存時會整包覆蓋現有 BOM（舊項目會被標記為停用）</li>
            <li>例如：生產 1 件成品需要 2400 雙裸筷，則「每件用量」填 2400</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

