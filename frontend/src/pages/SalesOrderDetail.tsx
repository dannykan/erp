import React, { useEffect, useState, useRef } from 'react';
import { Card, Descriptions, Table, Button, Space, message, Tag, Modal, Input, Checkbox, InputNumber } from 'antd';
import { api } from '../app/api';
import { printFromPath, sendToPrintQueue } from '../app/printService';
import { useParams, useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { useFrontendPrintPreview } from '../hooks/useFrontendPrintPreview';
import PrintTemplate from '../components/PrintTemplate';

export default function SalesOrderDetail() {
  const { id } = useParams();
  const soId = Number(id);
  const nav = useNavigate();
  const { isMobile } = useResponsive();
  const { showPreview, PrintPreview } = useFrontendPrintPreview();
  const printTemplateRef = useRef<HTMLDivElement>(null);
  const [so, setSo] = useState<any>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [shipNote, setShipNote] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [autoPrintShipping, setAutoPrintShipping] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const reload = async () => {
    const data = await api.getSO(soId);
    setSo(data);
  };

  async function loadStockForItems(items: any[]) {
    const ids = Array.from(new Set(items.map((x) => x.product_id).filter(Boolean)));
    if (!ids.length) return;
    const m = await api.stockBatch({ product_ids: ids, site: 'WAREHOUSE' });
    setStockMap(m);
  }

  useEffect(() => {
    reload();
  }, [soId]);

  useEffect(() => {
    if (so?.items) loadStockForItems(so.items);
  }, [so?.items]);

  if (!so) return <Card loading />;

  const statusMap: Record<string, { text: string; color: string }> = {
    DRAFT: { text: '待出貨', color: 'default' },
    PICKED: { text: '已揀貨', color: 'processing' },
    SHIPPED: { text: '已出貨', color: 'success' },
  };

  // 檢查庫存是否足夠（僅用於顯示提醒，不阻止出貨）
  const canShip = (so?.items || []).every((it: any) => (stockMap[String(it.product_id)] ?? 0) >= it.qty);
  const lowStockItems = (so?.items || []).filter((it: any) => {
    const stock = stockMap[String(it.product_id)] ?? 0;
    const need = Number(it.qty || 0);
    return stock < need;
  });

  const handlePick = async () => {
    try {
      await api.pickSO(soId);
      message.success('已完成揀貨');
      reload();
    } catch (err: any) {
      message.error(err.message || '揀貨失敗');
    }
  };

  const handleShip = async () => {
    try {
      // 檢查庫存不足，但只提醒不阻止
      if (!canShip && lowStockItems.length > 0) {
        const lowStockNames = lowStockItems.map((it: any) => {
          const stock = stockMap[String(it.product_id)] ?? 0;
          const need = Number(it.qty || 0);
          return `${it.product_name || `商品 #${it.product_id}`}（庫存：${stock}，需求：${need}）`;
        }).join('；');
        message.warning(`以下商品庫存不足：${lowStockNames}，但仍可出貨`, 5);
      }
      
      const soNo = so?.so_no; // 先保存 so_no，因为 reload 后 so 会更新
      await api.shipSO(soId, {
        ship_note: shipNote || undefined,
        logistics_no: logisticsNo || undefined,
      });
      message.success('已出貨並扣庫');
      setShipModalOpen(false);
      setShipNote('');
      setLogisticsNo('');
      await reload();
      
      // 如果勾选了自动列印，則發送到列印佇列
      if (autoPrintShipping) {
        try {
          const safeSoNo = (soNo || String(soId)).replace(/[\\/:*?"<>|]/g, '_');
          await printFromPath(`/sales-orders/${soId}/shipping.pdf`, {
            encoding: 'cp950',
            copies: 1,
            alsoDownload: false,
            filename: `出貨單_${safeSoNo}.pdf`,
          });
        } catch (err: any) {
          // 列印失敗不影響出貨成功，只提示（避免現場以為出貨失敗而重按）
          message.warning('出貨成功，但列印任務發送失敗，請到已出貨單點列印');
        }
      }
    } catch (err: any) {
      message.error(err.message || '出貨失敗');
    }
  };

  const handlePrintPicklist = () => {
    const safeSoNo = (so?.so_no || String(soId)).replace(/[\\/:*?"<>|]/g, '_');
    showPreview(`/sales-orders/${soId}/picklist.pdf`, {
      encoding: 'cp950',
      copies: 1,
      alsoDownload: false,
      filename: `揀貨單_${safeSoNo}.pdf`,
    });
  };

  const handlePrintShipping = () => {
    const safeSoNo = (so?.so_no || String(soId)).replace(/[\\/:*?"<>|]/g, '_');
    showPreview(`/sales-orders/${soId}/shipping.pdf`, {
      encoding: 'cp950',
      copies: 1,
      alsoDownload: false,
      filename: `出貨單_${safeSoNo}.pdf`,
    });
  };

  const handleConfirmPayment = async () => {
    try {
      await api.confirmPayment(soId, discountAmount);
      message.success('已確認收款');
      setPaymentModalOpen(false);
      setDiscountAmount(0);
      reload();
    } catch (err: any) {
      message.error(err.message || '確認收款失敗');
    }
  };

  // 計算銷貨總金額
  const calculateTotalAmount = () => {
    if (!so?.items) return 0;
    return so.items.reduce((sum: number, it: any) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.unit_price || 0);
      return sum + (qty * price);
    }, 0);
  };

  return (
    <>
      <Card
        title={`銷貨單：${so.so_no}`}
        extra={
          <Space wrap size={isMobile ? 'small' : 'middle'} direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
            <Button size={isMobile ? 'small' : 'middle'} onClick={() => nav(-1)}>返回</Button>
            {so.status === 'DRAFT' && (
              <Button type="primary" size={isMobile ? 'small' : 'middle'} onClick={handlePick}>
                完成揀貨
              </Button>
            )}
            {so.status === 'PICKED' && (
              <>
                <Button
                  type="primary"
                  danger
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => setShipModalOpen(true)}
                >
                  確認出貨
                </Button>
                {!canShip && (
                  <span style={{ color: 'red', fontSize: '12px' }}>庫存不足</span>
                )}
              </>
            )}
            {so.status === 'PICKED' && (
              <Button size={isMobile ? 'small' : 'middle'} onClick={handlePrintPicklist}>
                列印揀貨單
              </Button>
            )}
            {so.status === 'SHIPPED' && (
              <>
                <Button size={isMobile ? 'small' : 'middle'} onClick={handlePrintShipping}>
                  列印出貨單
                </Button>
                {!so.is_paid && (
                  <Button
                    type="primary"
                    size={isMobile ? 'small' : 'middle'}
                    onClick={() => {
                      setDiscountAmount(0);
                      setPaymentModalOpen(true);
                    }}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  >
                    確認收款
                  </Button>
                )}
              </>
            )}
            <Button
              size={isMobile ? 'small' : 'middle'}
              onClick={() => {
                if (printTemplateRef.current) {
                  showPreview(printTemplateRef.current, {
                    copies: 1,
                    filename: `銷貨單_${so.so_no || soId}.pdf`,
                  });
                } else {
                  message.error('無法生成預覽，請刷新頁面後重試');
                }
              }}
            >
              列印 PDF
            </Button>
          </Space>
        }
      >
      <Descriptions 
        bordered 
        size="small" 
        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
      >
        <Descriptions.Item label="客戶名稱">{so.customer_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="貨單號碼">{so.so_no || '-'}</Descriptions.Item>
        <Descriptions.Item label="送貨地址">{so.customer_address || '-'}</Descriptions.Item>
        <Descriptions.Item label="銷貨型別">-</Descriptions.Item>
        <Descriptions.Item label="聯繫電話">{so.customer_phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="日期">
          {so.doc_date ? (typeof so.doc_date === 'string' ? so.doc_date.split('T')[0] : so.doc_date) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="狀態">
          <Tag color={statusMap[so.status]?.color || 'default'}>
            {statusMap[so.status]?.text || so.status}
          </Tag>
        </Descriptions.Item>
        {so.status === 'SHIPPED' && (
          <Descriptions.Item label="付款狀態">
            {so.is_paid ? (
              <Tag color="green">已付款</Tag>
            ) : (
              <Tag color="orange">未付款</Tag>
            )}
            {so.is_paid && so.paid_at && (
              <span style={{ marginLeft: 8, color: '#666', fontSize: '12px' }}>
                ({new Date(so.paid_at).toLocaleString('zh-TW')})
              </span>
            )}
          </Descriptions.Item>
        )}
      </Descriptions>

      <div style={{ height: 12 }} />

      <Table
        rowKey="id"
        dataSource={so.items}
        pagination={false}
        scroll={{ x: isMobile ? 800 : 'max-content' }}
        size={isMobile ? 'small' : 'middle'}
        columns={[
          {
            title: '項',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
          },
          {
            title: '品名規格',
            width: 250,
            render: (_: any, it: any) => {
              const name = it.product_name || '';
              const spec = it.product_spec || '';
              return spec ? `${name} ${spec}` : name;
            },
          },
          {
            title: 'MARK',
            dataIndex: 'mark',
            width: 100,
            render: (v: string) => v || '-',
          },
          {
            title: '報價單位',
            dataIndex: 'price_unit',
            width: 100,
          },
          {
            title: '件入數(箱入數)',
            dataIndex: 'pieces_per_case',
            width: 120,
            render: (v: number) => v ? v : '-',
          },
          {
            title: '件數(箱數)',
            dataIndex: 'qty',
            width: 100,
            render: (v: number) => <strong>{v}</strong>,
          },
          {
            title: '單價',
            dataIndex: 'unit_price',
            width: 100,
            render: (v: number) => v ? v.toFixed(2) : '0.00',
          },
          {
            title: '小計',
            width: 100,
            render: (_: any, it: any) => {
              const qty = Number(it.qty || 0);
              const price = Number(it.unit_price || 0);
              return (qty * price).toFixed(2);
            },
          },
          {
            title: '備註',
            dataIndex: 'note',
            width: 150,
            render: (v: string) => v || '-',
          },
        ]}
        summary={(pageData) => {
          const totalQty = pageData.reduce((sum, it) => sum + Number(it.qty || 0), 0);
          const totalAmount = pageData.reduce((sum, it) => {
            const qty = Number(it.qty || 0);
            const price = Number(it.unit_price || 0);
            return sum + (qty * price);
          }, 0);
          
          return (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <strong>總件數：{totalQty}件</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={4} align="right">
                  <strong>銷貨總金額：{totalAmount.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />
      </Card>

      <Modal
        title="確認出貨"
        open={shipModalOpen}
        onOk={handleShip}
        onCancel={() => {
          setShipModalOpen(false);
          setShipNote('');
          setLogisticsNo('');
        }}
        okText="確認出貨"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>物流單號：</label>
            <Input
              value={logisticsNo}
              onChange={(e) => setLogisticsNo(e.target.value)}
              placeholder="選填"
            />
          </div>
          <div>
            <label>出貨備註：</label>
            <Input.TextArea
              value={shipNote}
              onChange={(e) => setShipNote(e.target.value)}
              placeholder="選填"
              rows={3}
            />
          </div>
          <div>
            <Checkbox
              checked={autoPrintShipping}
              onChange={(e) => setAutoPrintShipping(e.target.checked)}
            >
              出貨後自動下載出貨單 PDF
            </Checkbox>
          </div>
        </Space>
      </Modal>

        <Modal
          title="確認收款"
          open={paymentModalOpen}
          onOk={handleConfirmPayment}
          onCancel={() => {
            setPaymentModalOpen(false);
            setDiscountAmount(0);
          }}
          okText="確認收款"
          cancelText="取消"
          width={500}
        >
          <div style={{ padding: '20px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>銷貨總金額：</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                ${calculateTotalAmount().toFixed(2)}
              </div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>折讓金額：</div>
              <InputNumber
                style={{ width: '100%' }}
                value={discountAmount}
                onChange={(value) => setDiscountAmount(value || 0)}
                min={0}
                max={calculateTotalAmount()}
                precision={2}
                prefix="$"
                placeholder="請輸入折讓金額"
              />
            </div>

            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f5f5f5', 
              borderRadius: 4,
              marginTop: 16
            }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>實際收款金額：</div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                ${(calculateTotalAmount() - discountAmount).toFixed(2)}
              </div>
            </div>
          </div>
        </Modal>
        <PrintPreview />
        {/* 隱藏的列印模板（用於前端生成 PDF） */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          {so && (
            <div ref={printTemplateRef}>
              <PrintTemplate type="sales-order" data={so} />
            </div>
          )}
        </div>
    </>
  );
}

