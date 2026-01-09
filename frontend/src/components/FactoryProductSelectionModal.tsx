import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

type Product = {
  id: number;
  sku?: string;
  name: string;
  spec?: string;
  brand?: string;
  model?: string;
  size?: string;
  pack_quantity?: string;
  product_type?: string;
  is_active?: boolean;
};

type Props = {
  open: boolean;
  products: Product[];
  onClose: () => void;
  onSelect: (productId: number) => void;
};

// 解析產品名稱，提取類別、規格、包裝、包裝膜
function parseProductName(name: string): {
  category: string | null;
  spec: string | null;
  packaging: string | null;
} {
  // 格式：[ 類別 ] 規格 包裝 包裝膜
  // 例如：[ 竹筷 ] 5520 90X24 招財貓
  const match = name.match(/\[([^\]]+)\]\s*(.+)?/);
  if (match) {
    const category = match[1]?.trim() || null;
    const rest = match[2]?.trim() || null;
    
    if (!rest) {
      return { category, spec: null, packaging: null };
    }
    
    // 嘗試提取規格和包裝
    const specMatch = rest.match(/^(\S+)(?:\s+(.+))?$/);
    if (specMatch) {
      const spec = specMatch[1] || null;
      const packaging = specMatch[2] || null;
      return { category, spec, packaging };
    }
    
    return { category, spec: rest, packaging: null };
  }
  return { category: null, spec: null, packaging: null };
}

// 獲取所有規格（只顯示 5020、5520、6020）
// 即使沒有對應產品，也應該顯示這三個規格選項
function getSpecs(products: Product[]): Array<{ code: string; description: string }> {
  const allowedSpecs = ['5020', '5520', '6020'];
  const specs = new Map<string, string>();
  
  // 先初始化三個規格，確保它們都會顯示
  allowedSpecs.forEach(spec => {
    specs.set(spec, spec); // 默認描述就是規格代碼
  });
  
  // 不再從產品中提取描述，只顯示規格代碼
  
  return Array.from(specs.entries())
    .map(([code, description]) => ({ code, description }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// 獲取指定規格的所有包裝
function getPackagings(products: Product[], spec: string): Array<{ code: string; description: string }> {
  const packagings = new Map<string, string>();
  products.forEach(p => {
    const parsed = parseProductName(p.name);
    if (parsed.category === '竹筷' && parsed.spec === spec && parsed.packaging) {
      // 從包裝字符串中提取純包裝代碼（移除包裝膜信息）
      let packCode = parsed.packaging.trim();
      const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
      if (packMatch) {
        packCode = packMatch[1];
      }
      
      // 不再使用 pack_quantity 作為描述，只使用包裝代碼
      if (!packagings.has(packCode)) {
        packagings.set(packCode, packCode);
      }
    }
  });
  return Array.from(packagings.entries()).map(([code, description]) => ({ code, description }));
}

// 獲取指定規格的所有包裝膜選項
function getWraps(products: Product[], spec: string): string[] {
  const wraps = new Set<string>();
  products.forEach(p => {
    const parsed = parseProductName(p.name);
    if (parsed.category === '竹筷' && parsed.spec === spec) {
      // 從brand字段獲取包裝膜
      if (p.brand) {
        wraps.add(p.brand);
      }
      
      // 從產品名稱中提取包裝膜
      if (parsed.packaging) {
        const packMatch = parsed.packaging.match(/^\d+X\d+\s+(.+)$/);
        if (packMatch && packMatch[1]) {
          const wrapName = packMatch[1].trim();
          if (wrapName && !wrapName.match(/^\d+/)) {
            wraps.add(wrapName);
          }
        }
      }
    }
  });
  return Array.from(wraps).sort();
}

// 查找匹配的產品
function findProduct(
  products: Product[],
  spec: string,
  packaging: string,
  wrap?: string
): Product | null {
  if (wrap) {
    const withWrap = products.find(p => {
      const parsed = parseProductName(p.name);
      let packCode = parsed.packaging?.trim() || '';
      let wrapInName: string | null = null;
      const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
      if (packMatch) {
        packCode = packMatch[1];
        wrapInName = packMatch[2]?.trim() || null;
      }
      
      const brandMatch = p.brand === wrap;
      const nameMatch = wrapInName === wrap;
      
      return parsed.category === '竹筷' &&
             parsed.spec === spec &&
             packCode === packaging &&
             (brandMatch || nameMatch);
    });
    if (withWrap) return withWrap;
  }
  
  return products.find(p => {
    const parsed = parseProductName(p.name);
    let packCode = parsed.packaging?.trim() || '';
    const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
    if (packMatch) {
      packCode = packMatch[1];
    }
    
    return parsed.category === '竹筷' &&
           parsed.spec === spec &&
           packCode === packaging;
  }) || null;
}

export default function FactoryProductSelectionModal({ open, products, onClose, onSelect }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [selectedPackaging, setSelectedPackaging] = useState<string | null>(null);
  const [selectedWrap, setSelectedWrap] = useState<string | null>(null);

  // 重置狀態
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedSpec(null);
      setSelectedPackaging(null);
      setSelectedWrap(null);
    }
  }, [open]);

  const specs = useMemo(() => getSpecs(products), [products]);
  const packagings = useMemo(
    () => selectedSpec ? getPackagings(products, selectedSpec) : [],
    [products, selectedSpec]
  );
  const wraps = useMemo(
    () => selectedSpec ? getWraps(products, selectedSpec) : [],
    [products, selectedSpec]
  );

  const handleSpecSelect = (spec: string) => {
    setSelectedSpec(spec);
    setSelectedPackaging(null);
    setSelectedWrap(null);
    setStep(2);
  };

  const handlePackagingSelect = (packaging: string) => {
    setSelectedPackaging(packaging);
    setSelectedWrap(null);
    // 總是進入步驟 3（即使沒有包裝膜選項，也會顯示「無包裝膜」選項）
    setStep(3);
  };

  const handleWrapSelect = (wrap: string | null) => {
    setSelectedWrap(wrap);
    handleConfirm();
  };

  const handleConfirm = () => {
    if (!selectedSpec || !selectedPackaging) return;
    
    const product = findProduct(
      products,
      selectedSpec,
      selectedPackaging,
      selectedWrap || undefined
    );

    if (product) {
      onSelect(product.id);
      onClose();
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedSpec(null);
      setSelectedPackaging(null);
      setSelectedWrap(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedWrap(null);
    }
  };

  const getDisplayName = (): string => {
    if (!selectedSpec || !selectedPackaging) return '';
    const parts = [`[ 竹筷 ]`, selectedSpec, selectedPackaging];
    if (selectedWrap) {
      parts.push(selectedWrap);
    }
    return parts.join(' ');
  };

  // 工廠端總是顯示 3 步（規格 -> 包裝 -> 包裝膜）
  const maxSteps = 3;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {step > 1 && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              style={{ padding: 0 }}
            />
          )}
          <span>步驟 {step}/{maxSteps}：{step === 1 ? '選擇規格' : step === 2 ? '選擇包裝' : '選擇包裝膜'}</span>
        </div>
      }
    >
      {step > 1 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <Text strong>已選擇：</Text>
          <Text>{getDisplayName() || '尚未選擇'}</Text>
        </div>
      )}

      {step === 1 && (
        <div>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {specs.map(({ code, description }) => (
              <Card
                key={code}
                hoverable
                onClick={() => handleSpecSelect(code)}
                style={{
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Title level={4} style={{ margin: 0, fontSize: 20 }}>
                      {code}
                    </Title>
                    {description && (
                      <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'block' }}>
                        {description}
                      </Text>
                    )}
                  </div>
                  <Button type="primary">選擇</Button>
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}

      {step === 2 && selectedSpec && (
        <div>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {packagings.map(({ code }) => (
              <Card
                key={code}
                hoverable
                onClick={() => handlePackagingSelect(code)}
                style={{
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Title level={4} style={{ margin: 0, fontSize: 20 }}>
                      {code}
                    </Title>
                  </div>
                  <Button type="primary">選擇</Button>
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}

      {step === 3 && selectedSpec && selectedPackaging && (
        <div>
          {wraps.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {wraps.map(wrap => (
                <Card
                  key={wrap}
                  hoverable
                  onClick={() => handleWrapSelect(wrap)}
                  style={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  bodyStyle={{ padding: '24px' }}
                >
                  <Title level={4} style={{ margin: 0, fontSize: 20 }}>
                    {wrap}
                  </Title>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Card
                hoverable
                onClick={() => {
                  setSelectedWrap(null);
                  handleConfirm();
                }}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  minHeight: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <Title level={4} style={{ margin: 0, fontSize: 20 }}>
                  無包裝膜
                </Title>
              </Card>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 24, padding: '16px', backgroundColor: '#f0f7ff', borderRadius: 4 }}>
          <Text strong>確認品項資訊：</Text>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 600 }}>
            {getDisplayName()}
          </div>
        </div>
      )}
    </Modal>
  );
}

