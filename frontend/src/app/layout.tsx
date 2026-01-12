import React, { useMemo, useState, useEffect } from 'react';
import { ProLayout } from '@ant-design/pro-components';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, App, Space } from 'antd';
import { useAuth } from './useAuth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MenuOutlined } from '@ant-design/icons';

const allRoutes = {
  path: '/',
  routes: [
    // 架構瘦身：移除 Order/WorkOrder/Factory 相關菜單
    { path: '/products', name: '商品管理' },
    { path: '/customers', name: '客戶管理' },
    { path: '/users', name: '人員管理' },
    { path: '/inventory', name: '庫存查詢' },
    { path: '/test-print', name: '測試列印' },
    { path: '/purchase-orders', name: '進貨入庫' },
    { path: '/sales-orders', name: '銷貨出庫' },
    { path: '/sales-orders/list', name: '銷貨單查詢' },
    { path: '/return-orders', name: '退換貨' },
    {
      path: '/sales-reports',
      name: '銷售報表',
      routes: [
        { path: '/sales-reports/products-rank', name: '銷售報表 - 品項排行' },
        { path: '/sales-reports/product-customers', name: '銷售報表 - 品項→客戶' },
        { path: '/sales-reports/customer-history', name: '客戶銷貨單歷史' },
        { path: '/sales-orders/merged-unpaid', name: '合併未付款銷貨單' },
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
  // 员工只能看到两个页面
  if (role === 'worker') {
    return path === '/production-reports/my' || path === '/production-reports/new';
  }
  
  const adminOnly = ['/users', '/production-reports/approval'];
  if (adminOnly.includes(path)) return role === 'admin' || role === 'supervisor';
  const managementOnly = ['/production/kpi', '/sales-reports/products-rank', '/sales-reports/product-customers', '/sales-reports/customer-history', '/sales-orders/merged-unpaid'];
  if (managementOnly.includes(path)) return role === 'admin' || role === 'supervisor' || role === 'office';
  return true;
}

function filterRoutes(routes: any[], role: string): any[] {
  return routes
    .filter((r) => !r.path || canSee(r.path, role))
    .map((r) => (r.routes ? { ...r, routes: filterRoutes(r.routes, role) } : r));
}

// 獲取所有頂層菜單項的路徑（用於排序）
function getTopLevelPaths(routes: any[]): string[] {
  return routes.map(r => r.path || '');
}

// 應用排序到路由
function applySortOrder(routes: any[], sortOrder: string[]): any[] {
  const routeMap = new Map(routes.map(r => [r.path || '', r]));
  const sorted: any[] = [];
  
  // 先按排序順序添加
  for (const path of sortOrder) {
    const route = routeMap.get(path);
    if (route) {
      sorted.push(route);
      routeMap.delete(path);
    }
  }
  
  // 添加未在排序中的新路由
  for (const route of routeMap.values()) {
    sorted.push(route);
  }
  
  return sorted;
}

// 可拖曳的菜單項組件
function SortableMenuItem({ item, children, topLevelPaths }: any) {
  const isTopLevel = topLevelPaths.includes(item.path || '');
  
  if (!isTopLevel) {
    return <>{children}</>;
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.path || item.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
      }}
    >
      <div
        data-drag-handle
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          marginRight: 8,
          touchAction: 'none',
          userSelect: 'none',
          position: 'relative',
          zIndex: 1000,
        }}
        {...attributes}
        {...listeners}
        onMouseDown={(e) => {
          // 確保拖曳事件能觸發
          e.stopPropagation();
        }}
      >
        <MenuOutlined
          style={{
            color: '#999',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { me, logout } = useAuth();
  const role = me?.role || 'worker';
  const [isMobile, setIsMobile] = useState(false);
  const [menuSortOrder, setMenuSortOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(`menu_sort_order_${role}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 保存排序到 localStorage
  useEffect(() => {
    if (menuSortOrder.length > 0) {
      localStorage.setItem(`menu_sort_order_${role}`, JSON.stringify(menuSortOrder));
    }
  }, [menuSortOrder, role]);

  const filteredRoutes = useMemo(() => {
    return filterRoutes(allRoutes.routes || [], role);
  }, [role]);

  // 應用排序
  const routes = useMemo(() => {
    const topLevelPaths = getTopLevelPaths(filteredRoutes);
    
    // 如果沒有保存的排序，使用默認順序
    if (menuSortOrder.length === 0 || !topLevelPaths.every(p => menuSortOrder.includes(p))) {
      // 初始化排序
      const initialOrder = topLevelPaths;
      setMenuSortOrder(initialOrder);
      return {
        ...allRoutes,
        routes: filteredRoutes,
      };
    }
    
    return {
      ...allRoutes,
      routes: applySortOrder(filteredRoutes, menuSortOrder),
    };
  }, [filteredRoutes, menuSortOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移動5px才開始拖曳，避免誤觸
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = menuSortOrder.indexOf(active.id as string);
      const newIndex = menuSortOrder.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        setMenuSortOrder(arrayMove(menuSortOrder, oldIndex, newIndex));
      }
    }
  }

  const topLevelPaths = getTopLevelPaths(routes.routes || []);

  return (
    <App>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={topLevelPaths}
          strategy={verticalListSortingStrategy}
        >
          <ProLayout
            title="台悅進銷存系統"
            logo="/logo.svg"
            location={{ pathname: location.pathname }}
            route={routes as any}
            menuItemRender={(item, dom) => {
              const isTopLevel = topLevelPaths.includes(item.path || '');
              if (isTopLevel) {
                return (
                  <SortableMenuItem item={item} topLevelPaths={topLevelPaths}>
                    <Link 
                      to={item.path || '/'} 
                      style={{ 
                        display: 'block', 
                        width: '100%',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                      onClick={(e) => {
                        // 如果正在拖曳，阻止導航
                        if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {dom}
                    </Link>
                  </SortableMenuItem>
                );
              }
              return <Link to={item.path || '/'}>{dom}</Link>;
            }}
            rightContentRender={() => (
              <Space wrap size="small">
                {!isMobile && (
                  <span>{me?.display_name || me?.username || ''}</span>
                )}
                <Button
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                >
                  登出
                </Button>
              </Space>
            )}
            breakpoints={{
              xs: 480,
              sm: 576,
              md: 768,
              lg: 992,
              xl: 1200,
              xxl: 1600,
            }}
          >
            <div style={{ padding: isMobile ? '8px' : '12px' }}>{children}</div>
          </ProLayout>
        </SortableContext>
      </DndContext>
    </App>
  );
}

