import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Button, Space, message, Checkbox } from 'antd';
import { api } from '../app/api';

type Product = {
  id: number;
  sku?: string;
  name: string;
  product_type?: string;
  is_active?: boolean;
};

type BomItem = {
  raw_product_id: number;
  qty_per_fg_unit: number;
  note?: string;
};

type Props = {
  open: boolean;
  onCancel: () => void;
  onCreated: (productId: number) => void;
};

export default function CreateFGKitModal({ open, onCancel, onCreated }: Props) {
  const [form] = Form.useForm();
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [needSticker, setNeedSticker] = useState(false);

  useEffect(() => {
    if (open) {
      loadRawProducts();
      form.resetFields();
      setNeedSticker(false);
      // 设置默认值
      form.setFieldsValue({
        base_unit: '件',
        alt_unit: '包',
        alt_ratio: 1,
        safety_stock: 0,
      });
    }
  }, [open]);

  // 生成建议 SKU
  const generateSuggestedSKU = (pairsPerPack?: number, packsPerPiece?: number) => {
    if (pairsPerPack && packsPerPiece) {
      return `CHOP-${pairsPerPack}x${packsPerPiece}`;
    }
    return '';
  };

  const loadRawProducts = async () => {
    try {
      const products = await api.listProducts({});
      const raws = products.filter((p: Product) => p.product_type === 'RAW' && p.is_active !== false);
      setRawProducts(raws);
    } catch (e: any) {
      message.error('載入原料列表失敗：' + (e.message || String(e)));
    }
  };

  const handleAutoCalculate = () => {
    const values = form.getFieldsValue();
    const pairsPerPack = values.pairs_per_pack; // 每包几双
    const packsPerPiece = values.packs_per_piece; // 每件几包

    if (!pairsPerPack || !packsPerPiece) {
      message.warning('請先輸入「每包幾雙」和「每件幾包」');
      return;
    }

    // 生成建议 SKU（如果 SKU 为空）
    if (!values.sku) {
      const suggestedSKU = generateSuggestedSKU(pairsPerPack, packsPerPiece);
      if (suggestedSKU) {
        form.setFieldsValue({ sku: suggestedSKU });
      }
    }

    // 找到对应的 RAW 产品
    const bareChopsticks = rawProducts.find((p) => p.name.includes('裸筷') || p.name.includes('裸'));
    const innerBag = rawProducts.find((p) => p.name.includes('內袋') || p.name.includes('内袋'));
    const outerBag = rawProducts.find((p) => p.name.includes('外袋'));
    const sticker = rawProducts.find((p) => p.name.includes('貼紙') || p.name.includes('贴纸'));

    const bomItems: BomItem[] = [];

    // 裸筷 = 双/包 * 包/件
    if (bareChopsticks) {
      bomItems.push({
        raw_product_id: bareChopsticks.id,
        qty_per_fg_unit: pairsPerPack * packsPerPiece,
        note: '裸筷（雙）',
      });
    }

    // 內袋 = 包/件
    if (innerBag) {
      bomItems.push({
        raw_product_id: innerBag.id,
        qty_per_fg_unit: packsPerPiece,
        note: '內袋',
      });
    }

    // 外袋 = 1
    if (outerBag) {
      bomItems.push({
        raw_product_id: outerBag.id,
        qty_per_fg_unit: 1,
        note: '外袋',
      });
    }

    // 貼紙 = 1（需要時才加入）
    if (needSticker && sticker) {
      bomItems.push({
        raw_product_id: sticker.id,
        qty_per_fg_unit: 1,
        note: '貼紙',
      });
    }

    if (bomItems.length === 0) {
      message.warning('找不到對應的原料（裸筷、內袋、外袋）');
      return;
    }

    form.setFieldsValue({ bom_items: bomItems });
    message.success(`已自動計算 ${bomItems.length} 個 BOM 項目`);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!values.bom_items || values.bom_items.length === 0) {
        message.error('至少需要一個 BOM 項目');
        return;
      }

      // 檢查是否有重複的 raw_product_id
      const rawIds = values.bom_items.map((it: BomItem) => it.raw_product_id);
      if (new Set(rawIds).size !== rawIds.length) {
        message.error('不能有重複的原料');
        return;
      }

      setLoading(true);
      const payload = {
        sku: values.sku || undefined,
        name: values.name,
        spec: values.spec || undefined,
        base_unit: values.base_unit || '件',
        alt_unit: values.alt_unit || '包',
        alt_ratio: values.alt_ratio,
        safety_stock: values.safety_stock || 0,
        bom_items: values.bom_items.map((it: BomItem) => ({
          raw_product_id: it.raw_product_id,
          qty_per_fg_unit: Number(it.qty_per_fg_unit),
          note: it.note || undefined,
        })),
      };

      const result = await api.createFGKit(payload);
      message.success('已建立 FG 商品 + BOM');
      onCreated(result.product_id);
      form.resetFields();
      onCancel();
    } catch (e: any) {
      message.error('建立失敗：' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="建立 FG 商品 + BOM"
      open={open}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          建立
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="sku" label="品號（建議填寫）">
          <Input 
            placeholder="例如: CS-2101（自動計算後會建議 SKU）" 
            onChange={(e) => {
              // 如果用户手动输入，保留用户输入
              form.setFieldsValue({ sku: e.target.value });
            }}
          />
        </Form.Item>

        <Form.Item name="name" label="品名" rules={[{ required: true, message: '請輸入品名' }]}>
          <Input placeholder="例如: 21cm 免洗筷" />
        </Form.Item>

        <Form.Item name="spec" label="規格（可空）">
          <Input placeholder="例如: 21cm / 雙入" />
        </Form.Item>

        <Form.Item name="base_unit" label="主單位" rules={[{ required: true }]}>
          <Input placeholder="件" />
        </Form.Item>

        <Form.Item name="alt_unit" label="輔助單位" rules={[{ required: true }]}>
          <Input placeholder="包" />
        </Form.Item>

        <Form.Item
          name="alt_ratio"
          label="每件幾包（alt_ratio）"
          rules={[{ required: true, message: '請輸入每件幾包' }, { type: 'number', min: 1 }]}
        >
          <InputNumber placeholder="例如: 10" style={{ width: '100%' }} min={1} />
        </Form.Item>

        <Form.Item name="safety_stock" label="安全庫存">
          <InputNumber placeholder="0" style={{ width: '100%' }} min={0} />
        </Form.Item>

        <div style={{ margin: '16px 0', padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>一鍵自動計算 BOM：</strong>
            </div>
            <Space>
              <Form.Item name="pairs_per_pack" label="每包幾雙" style={{ margin: 0 }}>
                <InputNumber 
                  placeholder="例如: 240" 
                  style={{ width: 120 }} 
                  min={1}
                  onChange={() => {
                    // 當輸入變更時，如果 SKU 為空，自動生成建議值
                    const values = form.getFieldsValue();
                    if (!values.sku && values.pairs_per_pack && values.packs_per_piece) {
                      const suggested = generateSuggestedSKU(values.pairs_per_pack, values.packs_per_piece);
                      if (suggested) {
                        form.setFieldsValue({ sku: suggested });
                      }
                    }
                  }}
                />
              </Form.Item>
              <Form.Item name="packs_per_piece" label="每件幾包" style={{ margin: 0 }}>
                <InputNumber 
                  placeholder="例如: 10" 
                  style={{ width: 120 }} 
                  min={1}
                  onChange={() => {
                    // 當輸入變更時，如果 SKU 為空，自動生成建議值
                    const values = form.getFieldsValue();
                    if (!values.sku && values.pairs_per_pack && values.packs_per_piece) {
                      const suggested = generateSuggestedSKU(values.pairs_per_pack, values.packs_per_piece);
                      if (suggested) {
                        form.setFieldsValue({ sku: suggested });
                      }
                    }
                  }}
                />
              </Form.Item>
              <Button type="primary" onClick={handleAutoCalculate} style={{ marginTop: 30 }}>
                自動計算 BOM
              </Button>
            </Space>
            <Space style={{ marginTop: 8 }}>
              <Checkbox 
                checked={needSticker}
                onChange={(e) => setNeedSticker(e.target.checked)}
              >
                需要貼紙
              </Checkbox>
            </Space>
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              計算規則：裸筷 = 雙/包 × 包/件，內袋 = 包/件，外袋 = 1，貼紙 = 1（勾選「需要貼紙」時才加入）
            </div>
          </Space>
        </div>

        <Form.List name="bom_items">
          {(fields, { add, remove }) => (
            <>
              <div style={{ marginBottom: 8 }}>
                <strong>BOM 項目：</strong>
                <Button type="dashed" onClick={() => add()} size="small" style={{ marginLeft: 8 }}>
                  + 新增項目
                </Button>
              </div>
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
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

