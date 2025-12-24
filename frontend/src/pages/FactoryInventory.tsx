import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormSelect, ProFormDigit, ProFormText } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Drawer, Table, message, Switch, Space } from 'antd';
import { api } from '../app/api';

type InvRow = {
  product_id: number;
  sku?: string;
  name: string;
  unit: string;
  base_unit?: string;
  safety_stock: number;
  current_stock: number;
  low_stock: boolean;
};

// 統一獲取商品單位：優先使用 base_unit
function getProductUnit(row?: InvRow): string {
  return row?.base_unit || row?.unit || '個';
}

export default function FactoryInventory() {
  const actionRef = useRef<ActionType>();
  const [lowOnly, setLowOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<InvRow | null>(null);
  const [moves, setMoves] = useState<any[]>([]);
  const [adjOpen, setAdjOpen] = useState(false);

  async function openMoves(row: InvRow) {
    setSelected(row);
    setDrawerOpen(true);
    const data = await api.listInventoryMoves(row.product_id);
    setMoves(data);
  }

  const columns: ProColumns<InvRow>[] = [
    { title: '品號', dataIndex: 'sku', copyable: true },
    { title: '品名', dataIndex: 'name' },
    { 
      title: '單位', 
      search: false, 
      width: 80,
      render: (_, r) => getProductUnit(r),
    },
    { 
      title: '現有庫存', 
      dataIndex: 'current_stock', 
      search: false, 
      width: 110,
      render: (val: number) => {
        const formatted = typeof val === 'number' ? val.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : val;
        if (val < 0) {
          return <span style={{ color: 'red', fontWeight: 'bold' }}>{formatted}</span>;
        }
        return formatted;
      }
    },
    { title: '安全庫存', dataIndex: 'safety_stock', search: false, width: 110 },
    {
      title: '狀態',
      dataIndex: 'low_stock',
      search: false,
      width: 110,
      render: (_, r) => (r.low_stock ? <Tag color="red">低於安全</Tag> : <Tag color="green">正常</Tag>),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="moves" type="link" onClick={() => openMoves(r)}>
          看流水
        </Button>,
        <Button
          key="adj"
          type="link"
          onClick={() => {
            setSelected(r);
            setAdjOpen(true);
          }}
        >
          調整庫存
        </Button>,
      ],
    },
  ];

  return (
    <>
      <ProTable<InvRow>
        actionRef={actionRef}
        rowKey="product_id"
        headerTitle="工廠庫存"
        toolBarRender={() => [
          <Space key="tools" wrap>
            <span>只看低於安全</span>
            <Switch checked={lowOnly} onChange={(v) => { setLowOnly(v); actionRef.current?.reload(); }} />
            <Button onClick={() => actionRef.current?.reload()}>刷新</Button>
          </Space>,
        ]}
        request={async (params) => {
          const q = (params.keyword as string) || undefined;
          // 架構瘦身：統一使用 WAREHOUSE（此頁面已從路由移除，僅保留作為備份）
          const data = await api.listInventory({ q, site: 'WAREHOUSE', low_only: lowOnly });
          return { data, success: true };
        }}
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
      />

      <Drawer
        title={selected ? `庫存流水：${selected.name}` : '庫存流水'}
        open={drawerOpen}
        width={720}
        onClose={() => setDrawerOpen(false)}
      >
        <Table
          rowKey="id"
          dataSource={moves}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: '時間', dataIndex: 'created_at', width: 180 },
            { title: '類型', dataIndex: 'move_type', width: 80 },
            { title: '數量變動', dataIndex: 'qty_change', width: 100 },
            { title: '站點', dataIndex: 'site', width: 100 },
            { title: '階段', dataIndex: 'stage', width: 100 },
            { title: '單據類型', dataIndex: 'ref_type', width: 100 },
            { title: '單號', dataIndex: 'ref_no', width: 120 },
            { title: '備註', dataIndex: 'note', width: 200 },
          ]}
        />
      </Drawer>

      <ModalForm
        title={selected ? `調整庫存：${selected.name}` : '調整庫存'}
        open={adjOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setAdjOpen(false) }}
        initialValues={{
          move_type: 'ADJ',
          qty_change: 0,
          ref_type: 'ADJ',
        }}
        onFinish={async (v) => {
          if (!selected) return false;
          try {
            await api.createInventoryMove({
              product_id: selected.product_id,
              move_type: v.move_type,
              qty_change: Number(v.qty_change),
              site: 'WAREHOUSE',  // 架構瘦身：統一使用 WAREHOUSE
              ref_type: v.ref_type,
              ref_no: v.ref_no,
              note: v.note,
            });
            message.success('已新增庫存異動');
            setAdjOpen(false);
            actionRef.current?.reload();
            // 若 drawer 正開著，也刷新流水
            if (drawerOpen) openMoves(selected);
            return true;
          } catch {
            message.error('調整失敗');
            return false;
          }
        }}
      >
        <ProFormSelect
          name="move_type"
          label="異動類型"
          valueEnum={{
            IN: '入庫(+)',
            OUT: '出庫(-)',
            ADJ: '調整(+/-)',
          }}
          rules={[{ required: true }]}
        />
        <ProFormDigit name="qty_change" label="數量變動（可正可負）" rules={[{ required: true }]} />
        <ProFormText name="ref_type" label="來源類型（ADJ/PO/SO...）" />
        <ProFormText name="ref_no" label="來源單號（可空）" />
        <ProFormText name="note" label="備註（可空）" />
      </ModalForm>
    </>
  );
}

