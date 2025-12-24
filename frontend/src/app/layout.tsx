import React, { useMemo } from 'react';
import { ProLayout } from '@ant-design/pro-components';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, App } from 'antd';
import { useAuth } from './auth';

const allRoutes = {
  path: '/',
  routes: [
    // 架構瘦身：移除 Order/WorkOrder/Factory 相關菜單
    { path: '/products', name: '商品管理' },
    { path: '/customers', name: '客戶管理' },
    { path: '/users', name: '人員管理' },
    { path: '/inventory', name: '庫存查詢' },
    { path: '/purchase-orders', name: '進貨入庫' },
    { path: '/sales-orders', name: '銷貨出庫' },
    { path: '/sales-orders/list', name: '銷貨單查詢' },
    {
      path: '/sales-reports',
      name: '銷售報表',
      routes: [
        { path: '/sales-reports/products-rank', name: '銷售報表 - 品項排行' },
        { path: '/sales-reports/product-customers', name: '銷售報表 - 品項→客戶' },
      ],
    },
    {
      path: '/production',
      name: '工廠端',
      routes: [
        { path: '/production-reports/my', name: '我的生產回報' },
        { path: '/production-reports/new', name: '新增生產回報' },
        { path: '/production-reports/approval', name: '廠長確認（待核准）' },
        { path: '/production/records', name: '生產紀錄查詢' },
        { path: '/production/dashboard', name: '生產報表（統計）' },
        { path: '/production/kpi', name: '生產KPI（管理）' },
      ],
    },
  ],
};

function canSee(path: string, role: string) {
  const adminOnly = ['/users', '/production-reports/approval'];
  if (adminOnly.includes(path)) return role === 'admin' || role === 'supervisor';
  const managementOnly = ['/production/kpi', '/sales-reports/products-rank', '/sales-reports/product-customers'];
  if (managementOnly.includes(path)) return role === 'admin' || role === 'supervisor' || role === 'office';
  return true;
}

function filterRoutes(routes: any[], role: string): any[] {
  return routes
    .filter((r) => !r.path || canSee(r.path, role))
    .map((r) => (r.routes ? { ...r, routes: filterRoutes(r.routes, role) } : r));
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const role = me?.role || 'worker';

  const routes = useMemo(() => {
    return {
      ...allRoutes,
      routes: filterRoutes(allRoutes.routes || [], role),
    };
  }, [role]);

  return (
    <App>
      <ProLayout
        title="筷子工單系統"
        location={{ pathname: location.pathname }}
        route={routes as any}
        menuItemRender={(item, dom) => <Link to={item.path || '/'}>{dom}</Link>}
        rightContentRender={() => (
          <Button
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            登出
          </Button>
        )}
      >
        <div style={{ padding: 12 }}>{children}</div>
      </ProLayout>
    </App>
  );
}

