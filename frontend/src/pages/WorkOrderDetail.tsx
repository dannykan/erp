import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Table, Space, message } from 'antd';
import { api } from '../app/api';
import { printFromPath } from '../app/printService';
import { useParams, useNavigate } from 'react-router-dom';

export default function WorkOrderDetail() {
  const { id } = useParams();
  const woId = Number(id);
  const nav = useNavigate();
  const [wo, setWo] = useState<any>(null);

  async function load() {
    const data = await api.getWorkOrder(woId);
    setWo(data);
  }

  useEffect(() => { load(); }, [woId]);

  if (!wo) return <Card loading />;

  return (
    <Card
      title={`工單：${wo.wo_no}`}
      extra={
        <Space wrap size="small" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button onClick={() => nav(-1)}>返回</Button>
          <Button
            onClick={async () => {
              try {
                await api.startWorkOrder(woId);
                message.success('已開始');
                load();
              } catch {
                message.error('開始失敗');
              }
            }}
            disabled={wo.status === 'completed'}
          >
            開始
          </Button>

          <Button
            type="primary"
            onClick={async () => {
              try {
                await api.completeWorkOrder(woId, { message: 'completed' });
                message.success('已完工');
                load();
              } catch {
                message.error('完工失敗');
              }
            }}
            disabled={wo.status === 'completed'}
          >
            完工
          </Button>

          <Button
            onClick={async () => {
              await printFromPath(`/work-orders/${woId}/print`, {
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
        <Descriptions.Item label="客戶">{wo.customer_name}</Descriptions.Item>
        <Descriptions.Item label="交期">{wo.due_date || '-'}</Descriptions.Item>
        <Descriptions.Item label="急件">{wo.urgent ? '是' : '否'}</Descriptions.Item>
        <Descriptions.Item label="狀態">{wo.status}</Descriptions.Item>
        <Descriptions.Item 
          label="備註" 
          span={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
        >
          {wo.note || '-'}
        </Descriptions.Item>
      </Descriptions>

      <div style={{ height: 12 }} />

      <Table
        rowKey="id"
        dataSource={wo.items}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '品名', dataIndex: 'product_name', width: 200 },
          { title: '規格', dataIndex: 'spec', width: 120 },
          { title: '包裝', dataIndex: 'packaging', width: 100 },
          { title: '數量', dataIndex: 'qty', width: 80 },
          { title: '單位', dataIndex: 'unit', width: 80 },
          { title: '備註', dataIndex: 'note', width: 150 },
        ]}
      />
    </Card>
  );
}

