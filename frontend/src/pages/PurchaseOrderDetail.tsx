import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Table, Button, Space, message } from 'antd';
import { api } from '../app/api';
import { printFromPath } from '../app/printService';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrintPreview } from '../hooks/usePrintPreview';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const poId = Number(id);
  const nav = useNavigate();
  const { showPreview, PrintPreview } = usePrintPreview();
  const [po, setPo] = useState<any>(null);

  useEffect(() => {
    (async () => setPo(await api.getPO(poId)))();
  }, [poId]);

  if (!po) return <Card loading />;

  return (
    <Card
      title={`進貨單：${po.po_no}`}
      extra={
        <Space wrap size="small" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button onClick={() => nav(-1)}>返回</Button>
          <Button
            onClick={() => {
              showPreview(`/purchase-orders/${poId}/print`, {
                encoding: 'cp950',
                copies: 1,
                alsoDownload: false,
              });
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
        <Descriptions.Item label="供應商名稱">{po.supplier_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="貨單號碼">{po.po_no || '-'}</Descriptions.Item>
        <Descriptions.Item label="送貨地址">-</Descriptions.Item>
        <Descriptions.Item label="進貨型別">-</Descriptions.Item>
        <Descriptions.Item label="聯繫電話">-</Descriptions.Item>
        <Descriptions.Item label="日期">
          {po.doc_date ? (typeof po.doc_date === 'string' ? po.doc_date.split('T')[0] : po.doc_date) : '-'}
        </Descriptions.Item>
      </Descriptions>

      <div style={{ height: 12 }} />

      <Table
        rowKey="id"
        dataSource={po.items}
        pagination={false}
        scroll={{ x: 'max-content' }}
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
            render: (v: string) => v || '-',
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
                  <strong>進貨總金額：{totalAmount.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />
      <PrintPreview />
    </Card>
  );
}

