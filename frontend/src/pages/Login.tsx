import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Space } from 'antd';
import { api, setToken } from '../app/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';

export default function Login() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const { refreshMe, me } = useAuth();
  
  // 如果已經登入，自動跳轉
  useEffect(() => {
    if (me) {
      setLoading(false); // 確保重置 loading 狀態
      nav('/sales-orders', { replace: true });
    }
  }, [me, nav]);

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <Card title="登入" style={{ width: '100%', maxWidth: 360 }}>
        <Form
          layout="vertical"
          onFinish={async (v) => {
            setLoading(true);
            try {
              const data = await api.login(v.username, v.password);
              setToken(data.access_token);
              await refreshMe();
              message.success('登入成功');
              // 使用 window.location 强制刷新并跳转，确保状态已更新
              setTimeout(() => {
                window.location.href = '/sales-orders';
              }, 100);
            } catch (e) {
              console.error('Login error:', e);
              message.error('登入失敗：請確認帳密');
              setLoading(false);
            }
          }}
        >
          <Form.Item name="username" label="帳號" rules={[{ required: true }]}>
            <Input placeholder="admin" />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true }]}>
            <Input.Password placeholder="admin1234" />
          </Form.Item>

          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Button
              onClick={async () => {
                try {
                  await api.bootstrapAdmin();
                  message.success('已建立 admin/admin1234（已存在則略過）');
                } catch {
                  message.error('建立失敗：請先啟動後端');
                }
              }}
            >
              建立本機 admin
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              登入
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}

