import React from 'react';

interface PrintTemplateProps {
  type: 'sales-order' | 'purchase-order' | 'work-order';
  data: any;
  style?: React.CSSProperties;
}

/**
 * 列印模板組件（用於前端生成 PDF）
 * 格式與後端 PDF 保持一致，但使用前端渲染確保中文正確顯示
 */
// 格式化數字，添加千分位逗點
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// 格式化小數，添加千分位逗點並保留小數位
function formatDecimal(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function PrintTemplate({ type, data, style }: PrintTemplateProps) {
  // 根據紙張尺寸 2159x1397 調整（寬幅紙張，約550mm寬）
  const baseStyle: React.CSSProperties = {
    fontFamily: 'Courier, monospace',
    fontSize: '30pt', // 調整：大幅增大字體（約2.3倍）
    lineHeight: '1.4', // 調整：增加行高以配合大字體
    padding: '5mm', // 調整：減少左右邊距以使用更多空間
    width: '570mm', // 調整：增加寬度以使用更多左右空間（約多1/3）
    backgroundColor: '#ffffff',
    color: '#000000',
    ...style,
  };

  if (type === 'sales-order') {
    const so = data;
    const items = so.items || [];
    
    // 計算總計
    const totalCaseQty = items.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.case_qty || it.qty || 0);
      return sum + qty;
    }, 0);
    
    const totalAmount = items.reduce((sum: number, it: any) => {
      const qty = parseFloat(it.case_qty || it.qty || 0);
      const price = parseFloat(it.unit_price || 0);
      return sum + (qty * price);
    }, 0);

    const priceUnit = items[0]?.price_unit || '件';

    return (
      <div style={baseStyle}>
        {/* 標題 */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: '3mm', // 優化：減少間距
          fontSize: '40pt', // 調整：大幅增大標題字體
          fontWeight: 'bold',
        }}>
          <div>台 悅 估 價 單</div>
          <div style={{ fontSize: '30pt', marginTop: '2mm' }}>{so.so_no}</div>
        </div>

        {/* 客戶資訊 */}
        <div style={{ marginBottom: '3mm', fontSize: '30pt' }}> {/* 調整：大幅增大字體 */}
          <div>客戶名稱：{so.customer_name || '-'}</div>
          <div>送貨地址：{so.customer_address || '-'}</div>
          <div>聯繫電話：{so.customer_phone || '-'}</div>
          <div>日期：{so.doc_date ? (typeof so.doc_date === 'string' ? so.doc_date.split('T')[0] : so.doc_date) : '-'}</div>
        </div>

        {/* 表格 - 一體式，包含表頭和明細 */}
        <div style={{ 
          display: 'table',
          width: '100%',
          fontSize: '30pt', // 調整：大幅增大表格字體
          border: '3px solid #000', // 調整：加粗邊框以配合大字體
          marginBottom: '6mm', // 優化：減少間距
        }}>
          {/* 表頭 */}
          <div style={{ display: 'table-row', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
            <div style={{ 
              display: 'table-cell', 
              width: '20mm', // 調整：增加寬度以配合大字體
              border: '2px solid #000', // 調整：加粗邊框
              padding: '8px', // 調整：增加padding以配合大字體
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>項</div>
            <div style={{ 
              display: 'table-cell', 
              width: '250mm', // 調整：增加品名規格寬度以配合大字體
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>品名規格</div>
            <div style={{ 
              display: 'table-cell', 
              width: '30mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>件數</div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>包裝</div>
            <div style={{ 
              display: 'table-cell', 
              width: '30mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>數量</div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>單價</div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>金額</div>
            <div style={{ 
              display: 'table-cell', 
              width: '60mm', // 調整：增加寬度
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>備註</div>
          </div>

          {/* 明細 */}
          {items.map((it: any, idx: number) => {
            const productName = it.product_name || '';
            const productSpec = it.product_spec || '';
            // 不顯示貨號，只顯示品名和規格
            const productFull = [productName, productSpec].filter(Boolean).join(' ');
            const caseQty = parseFloat(it.case_qty || it.qty || 0);
            const unitPrice = parseFloat(it.unit_price || 0);
            const subtotal = caseQty * unitPrice;
            const piecesPerCase = it.pieces_per_case || '-';

            return (
              <div key={idx} style={{ display: 'table-row' }}>
                <div style={{ 
                  display: 'table-cell', 
                  width: '20mm',
                  border: '2px solid #000', // 調整：加粗邊框
                  padding: '8px', // 調整：增加padding
                  textAlign: 'center',
                }}>{idx + 1}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '250mm', // 調整：增加品名規格寬度
                  border: '2px solid #000',
                  padding: '8px',
                  wordBreak: 'break-word',
                }}>{productFull}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '30mm',
                  border: '2px solid #000',
                  padding: '8px',
                  textAlign: 'center',
                }}>{formatNumber(Math.floor(caseQty))}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '40mm',
                  border: '2px solid #000',
                  padding: '8px',
                  textAlign: 'center',
                }}>{piecesPerCase}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '30mm',
                  border: '2px solid #000',
                  padding: '8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                }}>{formatNumber(caseQty)}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '40mm',
                  border: '2px solid #000',
                  padding: '8px',
                  textAlign: 'right',
                }}>{formatDecimal(unitPrice, 2)}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '40mm',
                  border: '2px solid #000',
                  padding: '8px',
                  textAlign: 'right',
                }}>{formatNumber(Math.round(subtotal))}</div>
                <div style={{ 
                  display: 'table-cell', 
                  width: '60mm',
                  border: '2px solid #000',
                  padding: '8px',
                  fontSize: '30pt', // 調整：統一字體大小
                }}></div>
              </div>
            );
          })}
          
          {/* 總計行 */}
          <div style={{ display: 'table-row', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
            <div style={{ 
              display: 'table-cell', 
              width: '20mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
            }}></div>
            <div style={{ 
              display: 'table-cell', 
              width: '250mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
            }}>總計</div>
            <div style={{ 
              display: 'table-cell', 
              width: '30mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
            }}></div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
            }}></div>
            <div style={{ 
              display: 'table-cell', 
              width: '30mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'center',
            }}>{formatNumber(Math.floor(totalCaseQty))}</div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'right',
            }}></div>
            <div style={{ 
              display: 'table-cell', 
              width: '40mm',
              border: '2px solid #000',
              padding: '8px',
              textAlign: 'right',
            }}>{formatNumber(Math.round(totalAmount))}</div>
            <div style={{ 
              display: 'table-cell', 
              width: '60mm',
              border: '2px solid #000',
              padding: '8px',
            }}></div>
          </div>
        </div>

        {/* 表格下方資訊 */}
        <div style={{
          marginTop: '8mm', // 優化：減少間距
          fontSize: '30pt', // 調整：大幅增大字體
        }}>
          <div style={{ marginBottom: '3mm' }}> {/* 優化：減少間距 */}
            新北市汐止區橫科路407巷77號（F3倉）
          </div>
          <div style={{ marginBottom: '3mm' }}> {/* 優化：減少間距 */}
            電話：(02)2660-2501、(02)2660-1958 傳真：(02)2660-2370
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '100mm', // 調整：固定間距，減少2/3（原本space-between約120mm，現在40mm）
            marginTop: '4mm',
          }}>
            <span>會計：</span>
            <span>司機：</span>
            <span>業務：</span>
            <span>客戶簽收：</span>
          </div>
        </div>
      </div>
    );
  }

  // 其他類型的模板可以後續添加
  return <div style={baseStyle}>Unsupported print type: {type}</div>;
}
