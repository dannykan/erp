import React, { useEffect, useState } from 'react';
import { Card, Segmented, List, Tag, Button, Space, message } from 'antd';
import { api } from '../app/api';
import { useNavigate } from 'react-router-dom';

const statusOptions = [
  { label: '待生產', value: 'pending' },
  { label: '生產中', value: 'in_progress' },
  { label: '已完工', value: 'completed' },
];

export default function FactoryBoard() {
  const [status, setStatus] = useState<string>('pending');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await api.listWorkOrders();
      setData(res.filter((x: any) => x.status === status));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  return (
    <Card title="工廠看板" extra={<Button onClick={load}>刷新</Button>}>
      <Segmented options={statusOptions as any} value={status} onChange={(v) => setStatus(String(v))} block />
      <div style={{ height: 12 }} />

      <List
        loading={loading}
        dataSource={data}
        renderItem={(wo) => (
          <List.Item
            style={{ padding: 12 }}
            actions={[
              <Button key="open" type="primary" onClick={() => nav(`/work-orders/${wo.id}`)}>打開</Button>,
              status !== 'completed' ? (
                <Button
                  key="start"
                  onClick={async () => {
                    try {
                      await api.startWorkOrder(wo.id);
                      message.success('已開始');
                      load();
                    } catch {
                      message.error('開始失敗');
                    }
                  }}
                >
                  開始
                </Button>
              ) : null
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{wo.wo_no}</span>
                  {wo.urgent ? <Tag color="red">急件</Tag> : null}
                </Space>
              }
              description={
                <div style={{ fontSize: 16 }}>
                  <div>客戶：{wo.customer_name}</div>
                  <div>交期：{wo.due_date || '-'}</div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
