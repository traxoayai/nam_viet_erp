import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

interface Props {
  permission: string; // Key quyền (VD: 'pos-view')
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<Props> = ({ permission, children }) => {
  const { permissions } = useAuthStore();
  const navigate = useNavigate();

  // Bypass cho Super Admin (Nếu role là Admin hoặc có quyền đặc biệt)
  if (permissions.includes('admin-all')) return <>{children}</>;

  // Kiểm tra quyền
  if (!permissions.includes(permission)) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="403"
          title="403"
          subTitle="Xin lỗi, bạn chưa được cấp quyền truy cập tính năng này."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Về Trang chủ
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
};
