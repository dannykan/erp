import React, { useRef, useState } from 'react';
import { ProTable, ModalForm, ProFormText, ProFormSelect, ProFormSwitch } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { api } from '../app/api';

type U = {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function Users() {
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);

  const columns: ProColumns<U>[] = [
    { title: '帳號', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'display_name' },
    {
      title: '角色',
      dataIndex: 'role',
      valueEnum: {
        worker: { text: '員工' },
        supervisor: { text: '廠長/主管' },
        office: { text: '內勤' },
        admin: { text: '管理員' },
      },
      width: 120,
    },
    {
      title: '啟用',
      dataIndex: 'is_active',
      valueEnum: { true: { text: '是' }, false: { text: '否' } },
      width: 80,
    },
    { title: '建立時間', dataIndex: 'created_at', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button key="edit" type="link" onClick={() => { setEditing(r); setOpen(true); }}>
          編輯
        </Button>,
      ],
    },
  ];

  return (
    <>
      <ProTable<U>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="人員管理"
        toolBarRender={() => [
          <Button key="new" type="primary" onClick={() => { setEditing(null); setOpen(true); }}>
            新增人員
          </Button>,
        ]}
        request={async (params) => {
          const q = (params.keyword as string) || undefined;
          const data = await api.listUsers({ q });
          return { data, success: true };
        }}
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
      />

      <ModalForm
        key={editing?.id || 'new'}
        title={editing ? '編輯人員' : '新增人員'}
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={editing || { role: 'worker', is_active: true }}
        onFinish={async (v) => {
          try {
            if (editing) {
              await api.updateUser(editing.id, v);
            } else {
              await api.createUser(v);
            }
            message.success('已儲存');
            setOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            message.error('儲存失敗（帳號可能重複）');
            return false;
          }
        }}
      >
        <ProFormText name="username" label="帳號" rules={[{ required: true }]} />
        <ProFormText name="display_name" label="姓名" rules={[{ required: true }]} />
        <ProFormSelect
          name="role"
          label="角色"
          rules={[{ required: true }]}
          options={[
            { value: 'worker', label: '員工' },
            { value: 'supervisor', label: '廠長/主管' },
            { value: 'office', label: '內勤' },
            { value: 'admin', label: '管理員' },
          ]}
        />
        <ProFormSwitch name="is_active" label="啟用" />
        <ProFormText
          name="password"
          label={editing ? '重設密碼（可空）' : '初始密碼（可空，預設 123456）'}
          placeholder="不填則不修改/或使用預設"
        />
      </ModalForm>
    </>
  );
}

