import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function DefaultRedirect() {
  const { me, loading } = useAuth();
  
  if (loading) {
    return <div>載入中...</div>;
  }
  
  // 员工默认跳转到新增生產回報页面
  if (me?.role === 'worker') {
    return <Navigate to="/production-reports/new" replace />;
  }
  
  // 其他角色默认跳转到銷貨出庫页面
  return <Navigate to="/sales-orders" replace />;
}

