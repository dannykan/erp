import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './useAuth';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, me, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}><Spin /></div>;
  if (!token || !me) return <Navigate to="/login" replace />;
  return children;
}

