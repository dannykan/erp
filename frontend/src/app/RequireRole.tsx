import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export default function RequireRole({
  allow,
  children,
}: {
  allow: string[];
  children: JSX.Element;
}) {
  const { me, loading } = useAuth();
  const nav = useNavigate();

  if (loading) return children;
  const role = me?.role || '';
  if (!allow.includes(role)) {
    return (
      <Result
        status="403"
        title="無權限"
        subTitle="你沒有權限使用此功能。"
        extra={<Button type="primary" onClick={() => nav(-1)}>返回</Button>}
      />
    );
  }
  return children;
}

