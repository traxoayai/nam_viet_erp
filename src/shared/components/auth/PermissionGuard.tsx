import React from 'react';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { Result, Button } from 'antd';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, children }) => {
  const { permissions, loading } = useAuthStore();
  
  // Wait for permissions to load
  if (loading) return null; // Or a spinner

  const hasPermission = permissions.includes('admin-all') || permissions.includes(permission);

  if (!hasPermission) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Result
            status="403"
            title="403"
            subTitle="Xin lỗi, bạn không có quyền truy cập trang này."
            extra={<Button type="primary" href="/">Về trang chủ</Button>}
        />
      </div>
    );
  }

  return <>{children}</>;
};
