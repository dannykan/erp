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

// 解析產品名稱，提取類別、規格、包裝
function parseProductName(name: string): {
  category: string | null;
  spec: string | null;
  packaging: string | null;
} {
  // 格式：[ 類別 ] 規格 包裝
  // 例如：[ 竹筷 ] 5520 90X24
  // 或者：[ 竹筷 ] 5520 90X24 招財貓
  // 或者：[ 水果叉 ] CN 10cm*50盒
  const match = name.match(/\[([^\]]+)\]\s*(.+)?/);
  if (match) {
    const category = match[1]?.trim() || null;
    const rest = match[2]?.trim() || null;
    
    if (!rest) {
      return { category, spec: null, packaging: null };
    }
    
    // 嘗試提取規格和包裝
    // 規格通常是數字開頭（如 5520）或字母開頭（如 CN）
    // 包裝可能是 數字X數字 格式，或直接是文字
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

// 獲取所有類別
function getCategories(products: Product[]): string[] {
  const categories = new Set<string>();
  products.forEach(p => {
    const { category } = parseProductName(p.name);
    if (category) {
      categories.add(category);
    }
  });
  return Array.from(categories).sort();
}

// 獲取指定類別的所有規格
function getSpecs(products: Product[], category: string): Array<{ code: string; description: string }> {
  const specs = new Map<string, string>();
  products.forEach(p => {
    const parsed = parseProductName(p.name);
    if (parsed.category === category && parsed.spec) {
      // 規格代碼（如5520）和說明（如直徑5.5cm × 長度20cm）
      const specCode = parsed.spec;
      // 嘗試從model或spec字段獲取說明
      const description = p.model || p.spec || `${specCode}`;
      if (!specs.has(specCode)) {
        specs.set(specCode, description);
      }
    }
  });
  return Array.from(specs.entries()).map(([code, description]) => ({ code, description }));
}

// 獲取指定類別和規格的所有包裝
function getPackagings(products: Product[], category: string, spec: string): Array<{ code: string; description: string }> {
  const packagings = new Map<string, string>();
  products.forEach(p => {
    const parsed = parseProductName(p.name);
    if (parsed.category === category && parsed.spec === spec && parsed.packaging) {
      // 從包裝字符串中提取純包裝代碼（移除包裝膜信息）
      // 包裝格式通常是：數字X數字（如 90X24）
      // 包裝膜是文字（如 招財貓），通常出現在包裝後面
      let packCode = parsed.packaging.trim();
      
      // 如果包裝代碼中包含包裝膜信息（在brand字段中的文字），需要移除
      // 包裝格式：數字X數字，後面可能跟著文字（包裝膜）
      const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
      if (packMatch) {
        packCode = packMatch[1]; // 只取數字X數字部分
      }
      
      // 從pack_quantity獲取說明，或使用包裝代碼本身
      const description = p.pack_quantity || packCode;
      if (!packagings.has(packCode)) {
        packagings.set(packCode, description);
      }
    }
  });
  return Array.from(packagings.entries()).map(([code, description]) => ({ code, description }));
}

// 獲取指定類別的所有包裝膜選項（從brand字段和產品名稱中提取）
function getWraps(products: Product[], category: string): string[] {
  const wraps = new Set<string>();
  products.forEach(p => {
    const parsed = parseProductName(p.name);
    if (parsed.category === category) {
      // 優先從brand字段獲取包裝膜
      if (p.brand) {
        wraps.add(p.brand);
      }
      
      // 如果產品名稱中包含包裝膜信息（在包裝後面），也提取出來
      // 格式：[ 類別 ] 規格 包裝 包裝膜
      // 例如：[ 竹筷 ] 5520 90X24 招財貓
      if (parsed.packaging) {
        // 包裝格式：數字X數字，後面可能跟著文字（包裝膜）
        // 例如：90X24 招財貓 -> 提取 "招財貓"
        const packMatch = parsed.packaging.match(/^\d+X\d+\s+(.+)$/);
        if (packMatch && packMatch[1]) {
          // 提取包裝膜信息（包裝後面的文字）
          const wrapName = packMatch[1].trim();
          if (wrapName && !wrapName.match(/^\d+/)) {
            // 確保不是數字開頭（避免誤提取包裝數量）
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
  category: string,
  spec: string,
  packaging: string,
  wrap?: string
): Product | null {
  // 如果指定了包裝膜，優先找有包裝膜的產品
  if (wrap) {
    const withWrap = products.find(p => {
      const parsed = parseProductName(p.name);
      // 從包裝字符串中提取純包裝代碼（移除包裝膜信息）
      let packCode = parsed.packaging?.trim() || '';
      let wrapInName: string | null = null;
      const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
      if (packMatch) {
        packCode = packMatch[1];
        wrapInName = packMatch[2]?.trim() || null;
      }
      
      // 檢查包裝膜是否匹配（從brand字段或產品名稱中）
      const brandMatch = p.brand === wrap;
      const nameMatch = wrapInName === wrap;
      
      return parsed.category === category &&
             parsed.spec === spec &&
             packCode === packaging &&
             (brandMatch || nameMatch);
    });
    if (withWrap) return withWrap;
  }
  
  // 如果沒找到或沒指定包裝膜，找匹配類別、規格、包裝的產品（不檢查包裝膜）
  return products.find(p => {
    const parsed = parseProductName(p.name);
    // 從包裝字符串中提取純包裝代碼（移除包裝膜信息）
    let packCode = parsed.packaging?.trim() || '';
    const packMatch = packCode.match(/^(\d+X\d+)(?:\s+(.+))?/);
    if (packMatch) {
      packCode = packMatch[1];
    }
    
    return parsed.category === category &&
           parsed.spec === spec &&
           packCode === packaging;
  }) || null;
}

// 判斷類別是否需要包裝膜步驟
function needsWrapStep(category: string): boolean {
  // 目前只有竹筷類需要包裝膜
  return category === '竹筷';
}

export default function ProductSelectionModal({ open, products, onClose, onSelect }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [selectedPackaging, setSelectedPackaging] = useState<string | null>(null);
  const [selectedWrap, setSelectedWrap] = useState<string | null>(null);

  // 重置狀態
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedCategory(null);
      setSelectedSpec(null);
      setSelectedPackaging(null);
      setSelectedWrap(null);
    }
  }, [open]);

  const categories = useMemo(() => getCategories(products), [products]);
  const specs = useMemo(
    () => selectedCategory ? getSpecs(products, selectedCategory) : [],
    [products, selectedCategory]
  );
  const packagings = useMemo(
    () => (selectedCategory && selectedSpec) ? getPackagings(products, selectedCategory, selectedSpec) : [],
    [products, selectedCategory, selectedSpec]
  );
  const wraps = useMemo(
    () => selectedCategory ? getWraps(products, selectedCategory) : [],
    [products, selectedCategory]
  );

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedSpec(null);
    setSelectedPackaging(null);
    setSelectedWrap(null);
    if (needsWrapStep(category)) {
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleSpecSelect = (spec: string) => {
    setSelectedSpec(spec);
    setSelectedPackaging(null);
    setSelectedWrap(null);
    setStep(3);
  };

  const handlePackagingSelect = (packaging: string) => {
    setSelectedPackaging(packaging);
    setSelectedWrap(null);
    if (selectedCategory && needsWrapStep(selectedCategory)) {
      // 竹筷類必須進入第4步（選擇包裝膜）
      setStep(4);
    } else {
      // 非竹筷類，直接確認
      handleConfirm();
    }
  };

  const handleWrapSelect = (wrap: string) => {
    setSelectedWrap(wrap);
    handleConfirm();
  };

  const handleConfirm = () => {
    if (!selectedCategory || !selectedSpec || !selectedPackaging) return;
    
    const product = findProduct(
      products,
      selectedCategory,
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
      setSelectedCategory(null);
      setSelectedSpec(null);
      setSelectedPackaging(null);
      setSelectedWrap(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedSpec(null);
      setSelectedPackaging(null);
      setSelectedWrap(null);
    } else if (step === 4) {
      setStep(3);
      setSelectedWrap(null);
    }
  };

  const getDisplayName = (): string => {
    if (!selectedCategory || !selectedSpec || !selectedPackaging) return '';
    const parts = [`[ ${selectedCategory} ]`, selectedSpec, selectedPackaging];
    if (selectedWrap) {
      parts.push(selectedWrap);
    }
    return parts.join(' ');
  };

  const maxSteps = selectedCategory && needsWrapStep(selectedCategory) ? 4 : 3;

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
          <span>步驟 {step}/{maxSteps}：{step === 1 ? '選擇類別' : step === 2 ? '選擇規格' : step === 3 ? '選擇包裝' : '選擇包裝膜'}</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {categories.map(category => (
              <Card
                key={category}
                hoverable
                onClick={() => handleCategorySelect(category)}
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
                  {category}
                </Title>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 2 && selectedCategory && (
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

      {step === 3 && selectedCategory && selectedSpec && (
        <div>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {packagings.map(({ code, description }) => (
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

      {step === 4 && selectedCategory && selectedSpec && selectedPackaging && (
        <div>
          {wraps.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {wraps.length > 0 ? (
                wraps.map(wrap => (
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
                ))
              ) : (
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
              )}
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

      {step === 4 && (
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

