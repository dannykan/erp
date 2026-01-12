import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layout';
import RequireAuth from './RequireAuth';
import RequireRole from './RequireRole';
import { useAuth } from './useAuth';

import Login from '../pages/Login';
// 架構瘦身：移除 Order/WorkOrder/Factory 相關頁面
// import Orders from '../pages/Orders';
// import NewOrder from '../pages/NewOrder';
// import WorkOrders from '../pages/WorkOrders';
// import WorkOrderDetail from '../pages/WorkOrderDetail';
// import FactoryBoard from '../pages/FactoryBoard';
import Products from '../pages/Products';
import Customers from '../pages/Customers';
import Inventory from '../pages/Inventory';
// 架構瘦身：移除 FactoryInventory/WarehouseInventory，統一使用 Inventory
// import WarehouseInventory from '../pages/WarehouseInventory';
// import FactoryInventory from '../pages/FactoryInventory';
import PurchaseOrders from '../pages/PurchaseOrders';
import NewPurchaseOrder from '../pages/NewPurchaseOrder';
import PurchaseOrderDetail from '../pages/PurchaseOrderDetail';
import SalesOrders from '../pages/SalesOrders';
import SalesOrdersList from '../pages/SalesOrdersList';
import NewSalesOrder from '../pages/NewSalesOrder';
import SalesOrderDetail from '../pages/SalesOrderDetail';
import ReturnOrders from '../pages/ReturnOrders';
import NewReturnOrder from '../pages/NewReturnOrder';
import ProductionMy from '../pages/ProductionMy';
import ProductionNew from '../pages/ProductionNew';
import ProductionApproval from '../pages/ProductionApproval';
import ProductionDetail from '../pages/ProductionDetail';
import ProductionRecords from '../pages/ProductionRecords';
import ProductionDashboard from '../pages/ProductionDashboard';
import ProductionKPI from '../pages/ProductionKPI';
import Users from '../pages/Users';
import BOM from '../pages/BOM';
import SalesReportProductsRank from '../pages/SalesReportProductsRank';
import SalesReportProductCustomers from '../pages/SalesReportProductCustomers';
import CustomerSalesHistory from '../pages/CustomerSalesHistory';
import MergedUnpaidSOs from '../pages/MergedUnpaidSOs';
import TestPrint from '../pages/TestPrint';
import DefaultRedirect from './DefaultRedirect';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* 架構瘦身：移除 Order/WorkOrder/Factory 相關路由 */}

      <Route
        path="/products"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><Products /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/bom/:fgProductId"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor']}>
              <AppLayout><BOM /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/customers"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><Customers /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/inventory"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><Inventory /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* 架構瘦身：移除 FactoryInventory/WarehouseInventory，統一使用 Inventory */}

      <Route
        path="/purchase-orders"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><PurchaseOrders /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-orders/new"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><NewPurchaseOrder /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-orders/:id"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><PurchaseOrderDetail /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/sales-orders"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><SalesOrders /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-orders/list"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><SalesOrdersList /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-orders/new"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><NewSalesOrder /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-orders/:id/edit"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><NewSalesOrder /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-orders/:id"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><SalesOrderDetail /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-reports/products-rank"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><SalesReportProductsRank /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-reports/product-customers"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><SalesReportProductCustomers /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-reports/customer-history"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><CustomerSalesHistory /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-orders/merged-unpaid"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><MergedUnpaidSOs /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/return-orders"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><ReturnOrders /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/return-orders/new"
        element={
          <RequireAuth>
            <RequireRole allow={['admin','supervisor','office']}>
              <AppLayout><NewReturnOrder /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/production-reports/my"
        element={
          <RequireAuth>
            <AppLayout><ProductionMy /></AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/production-reports/new"
        element={
          <RequireAuth>
            <AppLayout><ProductionNew /></AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/production-reports/approval"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor']}>
              <AppLayout><ProductionApproval /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/production-reports/:id"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office', 'worker']}>
              <AppLayout><ProductionDetail /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/production/records"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><ProductionRecords /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/production/dashboard"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><ProductionDashboard /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/production/kpi"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><ProductionKPI /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/users"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor']}>
              <AppLayout><Users /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/test-print"
        element={
          <RequireAuth>
            <RequireRole allow={['admin', 'supervisor', 'office']}>
              <AppLayout><TestPrint /></AppLayout>
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route path="/" element={<DefaultRedirect />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

