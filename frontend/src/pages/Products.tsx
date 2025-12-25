import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../app/api';
import { useResponsive } from '../hooks/useResponsive';

type Product = {
  id: number;
  sku?: string;
  name: string;
  spec?: string;
  unit: string;
  product_type?: string;
  base_unit?: string;
  alt_unit?: string;
  alt_ratio?: number;
  safety_stock: number;
  is_active: boolean;
  quotation_unit?: string;
  pieces_per_case?: number;
  pack_quantity?: string;
  model?: string;
  brand?: string;
  size?: string;
  origin?: string;
  created_at: string;
};

export default function Products() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();

  const columns: ProColumns<Product>[] = [
    { 
      title: '貨號', 
      dataIndex: 'sku', 
      copyable: true, 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.sku || '';
        const bVal = b.sku || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '產品名稱', 
      dataIndex: 'name', 
      width: 250,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    { 
      title: '報價單位', 
      dataIndex: 'quotation_unit', 
      width: 90,
      sorter: (a, b) => {
        const aVal = a.quotation_unit || '';
        const bVal = b.quotation_unit || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '件入數(箱入數)', 
      dataIndex: 'pieces_per_case', 
      width: 120,
      sorter: (a, b) => {
        const aVal = a.pieces_per_case ?? 0;
        const bVal = b.pieces_per_case ?? 0;
        return aVal - bVal;
      },
    },
    { 
      title: '包入數', 
      dataIndex: 'pack_quantity', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.pack_quantity || '';
        const bVal = b.pack_quantity || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '型號', 
      dataIndex: 'model', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.model || '';
        const bVal = b.model || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '規格', 
      dataIndex: 'spec', 
      width: 150,
      sorter: (a, b) => {
        const aVal = a.spec || '';
        const bVal = b.spec || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '品牌', 
      dataIndex: 'brand', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.brand || '';
        const bVal = b.brand || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '尺寸', 
      dataIndex: 'size', 
      width: 100,
      sorter: (a, b) => {
        const aVal = a.size || '';
        const bVal = b.size || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '產地', 
      dataIndex: 'origin', 
      width: 80,
      sorter: (a, b) => {
        const aVal = a.origin || '';
        const bVal = b.origin || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '商品類型', 
      dataIndex: 'product_type',
      valueType: 'select',
      valueEnum: {
        RAW: { text: '原物料' },
        FG: { text: '成品' },
        TRADE: { text: '外購轉賣' },
      },
      sorter: (a, b) => {
        const aVal = a.product_type || '';
        const bVal = b.product_type || '';
        return aVal.localeCompare(bVal);
      },
      render: (_, r) => {
        const typeMap: Record<string, string> = { RAW: '原物料', FG: '成品', TRADE: '外購轉賣' };
        return typeMap[r.product_type || 'TRADE'] || r.product_type || '-';
      },
      width: 100
    },
    { 
      title: '單位設定', 
      width: 200,
      sorter: (a, b) => {
        const aParts: string[] = [];
        if (a.base_unit) aParts.push(a.base_unit);
        if (a.alt_unit && a.alt_ratio) {
          aParts.push(`1${a.base_unit || '個'}=${a.alt_ratio}${a.alt_unit}`);
        }
        const aStr = aParts.length > 0 ? aParts.join(' / ') : (a.unit || '-');
        
        const bParts: string[] = [];
        if (b.base_unit) bParts.push(b.base_unit);
        if (b.alt_unit && b.alt_ratio) {
          bParts.push(`1${b.base_unit || '個'}=${b.alt_ratio}${b.alt_unit}`);
        }
        const bStr = bParts.length > 0 ? bParts.join(' / ') : (b.unit || '-');
        
        return aStr.localeCompare(bStr);
      },
      render: (_, r) => {
        const parts: string[] = [];
        if (r.base_unit) {
          parts.push(r.base_unit);
        }
        if (r.alt_unit && r.alt_ratio) {
          parts.push(`1${r.base_unit || '個'}=${r.alt_ratio}${r.alt_unit}`);
        }
        return parts.length > 0 ? parts.join(' / ') : (r.unit || '-');
      }
    },
    { 
      title: '預設單位', 
      dataIndex: 'unit', 
      width: 80,
      sorter: (a, b) => {
        const aVal = a.unit || '';
        const bVal = b.unit || '';
        return aVal.localeCompare(bVal);
      },
    },
    { 
      title: '安全庫存', 
      dataIndex: 'safety_stock', 
      width: 110,
      sorter: (a, b) => a.safety_stock - b.safety_stock,
    },
    {
      title: '狀態',
      dataIndex: 'is_active',
      valueType: 'select',
      valueEnum: {
        true: { text: '啟用' },
        false: { text: '停用' },
      },
      sorter: (a, b) => {
        if (a.is_active === b.is_active) return 0;
        return a.is_active ? 1 : -1;
      },
      render: (_, r) => (r.is_active ? <Tag color="green">啟用</Tag> : <Tag>停用</Tag>),
      width: 80
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button
          key="edit"
          type="link"
          onClick={() => {
            setEditing(r);
            setOpen(true);
          }}
        >
          編輯
        </Button>,
        ...(r.product_type === 'FG' ? [
          <Button
            key="bom"
            type="link"
            onClick={() => navigate(`/bom/${r.id}`)}
          >
            BOM
          </Button>,
        ] : []),
      ],
    },
  ];

  return (
    <>
      <ProTable<Product>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="商品列表"
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            size={isMobile ? 'small' : 'middle'}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            新增商品
          </Button>,
        ]}
        request={async (params) => {
          // ProTable 搜索参数：优先使用 keyword，如果没有则使用具体字段（如 name, sku）
          // 收集所有可能包含搜索值的参数
          const searchValues: string[] = [];
          if (params.keyword && typeof params.keyword === 'string') searchValues.push(params.keyword.trim());
          if (params.name && typeof params.name === 'string') searchValues.push(params.name.trim());
          if (params.sku && typeof params.sku === 'string') searchValues.push(params.sku.trim());
          
          // 使用第一个非空值作为搜索关键词
          const q = searchValues.find(v => v.length > 0) || undefined;
          
          const active = params.is_active !== undefined ? String(params.is_active) : undefined;
          
          console.log('Products search params:', { params, q, active }); // 调试用
          
          const data = await api.listProducts({ q, active });
          return { data, success: true };
        }}
        columns={columns}
        search={{ 
          labelWidth: isMobile ? 80 : isTablet ? 100 : 'auto',
          span: isMobile ? 24 : isTablet ? 12 : 8,
          defaultCollapsed: true,
        }}
        pagination={{ 
          pageSize: 20,
          showSizeChanger: !isMobile,
          showQuickJumper: !isMobile,
          showTotal: (total) => `共 ${total} 條`,
          simple: isMobile,
          size: isMobile ? 'small' : 'default',
        }}
        scroll={{ x: isMobile ? 1200 : 1400 }}
      />

      <ModalForm
        key={editing?.id || 'new'}
        title={editing ? '編輯商品' : '新增商品'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => setOpen(false),
        }}
        initialValues={
          editing || {
            unit: '包',
            product_type: 'TRADE',
            base_unit: '個',
            safety_stock: 0,
            is_active: true,
          }
        }
        onFinish={async (v) => {
          try {
            if (editing) {
              await api.updateProduct(editing.id, v);
              message.success('已更新');
            } else {
              await api.createProduct(v);
              message.success('已新增');
            }
            setOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e: any) {
            message.error('儲存失敗（品號可能重複/後端錯誤）');
            return false;
          }
        }}
      >
        <ProFormText name="sku" label="貨號（可空）" placeholder="例如: B50001" />
        <ProFormText name="name" label="產品名稱" rules={[{ required: true }]} />
        <ProFormText name="quotation_unit" label="報價單位（可空）" placeholder="例如: 件" />
        <ProFormDigit name="pieces_per_case" label="件入數(箱入數)（可空）" placeholder="例如: 27" min={0} />
        <ProFormText name="pack_quantity" label="包入數（可空）" placeholder="例如: 100雙" />
        <ProFormText name="model" label="型號（可空）" placeholder="例如: 5020" />
        <ProFormText name="spec" label="規格（可空）" placeholder="例如: 100X27" />
        <ProFormText name="brand" label="品牌（可空）" placeholder="例如: 品牌名稱" />
        <ProFormText name="size" label="尺寸（可空）" placeholder="例如: 100X27" />
        <ProFormText name="origin" label="產地（可空）" placeholder="例如: CN, TW" />
        
        <Divider orientation="left" style={{ marginTop: 16, marginBottom: 16 }}>其他設定</Divider>
        
        <ProFormSelect
          name="product_type"
          label="商品類型"
          rules={[{ required: true }]}
          options={[
            { label: '原物料 (RAW)', value: 'RAW' },
            { label: '成品 (FG)', value: 'FG' },
            { label: '外購轉賣 (TRADE)', value: 'TRADE' },
          ]}
        />
        
        <Divider orientation="left" style={{ marginTop: 16, marginBottom: 16 }}>單位設定</Divider>
        
        <ProFormText
          name="base_unit"
          label="主單位"
          placeholder="例如: 袋"
          tooltip="主要庫存單位"
          rules={[{ required: true }]}
        />
        
        <ProFormText
          name="alt_unit"
          label="次單位（可空）"
          placeholder="例如: 包"
          tooltip="次單位（選填）"
        />
        
        <ProFormDigit
          name="alt_ratio"
          label="換算倍率（可空）"
          placeholder="例如: 10"
          tooltip="1 主單位 = 多少次單位（例如: 1袋=10包，則填10）。若填了次單位，此欄位必填且需 > 0"
          min={1}
          extra={
            <span style={{ color: '#999', fontSize: '12px' }}>
              換算：1 主單位 = N 次單位（例：1袋=30包，則填30）
            </span>
          }
        />
        
        <ProFormText 
          name="unit" 
          label="預設顯示單位" 
          placeholder="包"
          tooltip="在系統中預設顯示的單位"
          rules={[{ required: true }]}
        />
        
        <Divider orientation="left" style={{ marginTop: 16, marginBottom: 16 }}>其他設定</Divider>
        
        <ProFormDigit name="safety_stock" label="安全庫存" min={0} />
        <ProFormSwitch name="is_active" label="啟用" />
      </ModalForm>
    </>
  );
}

