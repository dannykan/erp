import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Table, Button, Space, Tag, Modal, Input, message } from 'antd';
import { api } from '../app/api';
import { useParams, useNavigate } from 'react-router-dom';

export default function ProductionDetail() {
  const { id } = useParams();
  const prId = Number(id);
  const nav = useNavigate();

  const [pr, setPr] = useState<any>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  async function reload() {
    const data = await api.getPR(prId);
    setPr(data);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setUserMap(await api.userIdMap());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prId]);

  if (!pr) return <Card loading />;

  const statusTag =
    pr.status === 'SUBMITTED' ? <Tag color="gold">待確認</Tag> :
    pr.status === 'APPROVED' ? <Tag color="green">已核准</Tag> :
    <Tag color="red">已退回</Tag>;

  return (
    <>
      <Card
        title={`生產回報：${pr.pr_no}`}
        extra={
          <Space>
            <Button onClick={() => nav(-1)}>返回</Button>

            {/* 列印：你想要 PDF 我也能幫你加 endpoint，先給占位 */}
            <Button
              onClick={() => {
                message.info('列印功能下一步可加：PR 列印 PDF（含簽核欄位）');
              }}
            >
              列印（占位）
            </Button>

            {pr.status === 'SUBMITTED' && (
              <>
                <Button
                  type="primary"
                  onClick={async () => {
                    try {
                      await api.approvePR(pr.id);
                      message.success('已核准並入倉庫庫存');
                      await reload();
                    } catch {
                      message.error('核准失敗');
                    }
                  }}
                >
                  核准入庫
                </Button>

                <Button
                  danger
                  onClick={() => {
                    setRejectReason('');
                    setRejectOpen(true);
                  }}
                >
                  退回
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="回報日期">{pr.report_date}</Descriptions.Item>
          <Descriptions.Item label="狀態">{statusTag}</Descriptions.Item>
          <Descriptions.Item label="回報人">
            {userMap[String(pr.reported_by_user_id)] || `ID ${pr.reported_by_user_id}`}
          </Descriptions.Item>
          <Descriptions.Item label="核准人">
            {pr.approved_by_user_id ? (userMap[String(pr.approved_by_user_id)] || `ID ${pr.approved_by_user_id}`) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="核准時間" span={2}>{pr.approved_at ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="備註" span={2}>{pr.note || '-'}</Descriptions.Item>
        </Descriptions>

        <div style={{ height: 12 }} />

        <Table
          rowKey="id"
          dataSource={pr.items}
          pagination={false}
          columns={[
            { title: '品號', dataIndex: 'product_sku', width: 140 },
            { title: '品名', dataIndex: 'product_name', width: 240 },
            { title: '商品預設規格', dataIndex: 'product_spec' },
            { title: '今日規格（員工填）', dataIndex: 'spec_text' },
            { title: '數量', dataIndex: 'qty', width: 90 },
            { title: '單位', dataIndex: 'unit', width: 80 },
            { title: '備註', dataIndex: 'note' },
          ]}
        />
      </Card>

      <Modal
        title="退回原因"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          try {
            await api.rejectPR(pr.id, rejectReason);
            message.success('已退回');
            setRejectOpen(false);
            await reload();
          } catch {
            message.error('退回失敗');
          }
        }}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="請輸入退回原因（可留空）"
        />
      </Modal>
    </>
  );
}

