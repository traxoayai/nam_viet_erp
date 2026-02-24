import { Tooltip } from "antd";
import React from "react";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";

interface AccessProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode; // Hiển thị gì nếu thiếu quyền (null = ẩn luôn)
  hide?: boolean; // True: Ẩn hoàn toàn | False: Hiện mờ (Disabled)
}

export const Access: React.FC<AccessProps> = ({
  permission,
  children,
  fallback = null,
  hide = false,
}) => {
  const { permissions } = useAuthStore();
  // Admin-all luôn có quyền
  const hasPermission =
    permissions.includes("admin-all") || permissions.includes(permission);

  if (hasPermission) return <>{children}</>;
  if (hide) return <>{fallback}</>;

  // Mặc định: Disable (Hiện mờ) để UX tốt hơn
  if (React.isValidElement(children)) {
    return (
      <Tooltip title="Bạn không có quyền thực hiện thao tác này">
        <span
          style={{
            cursor: "not-allowed",
            opacity: 0.6,
            display: "inline-block",
          }}
        >
          {React.cloneElement(
            children as React.ReactElement,
            { disabled: true, onClick: undefined } as any
          )}
        </span>
      </Tooltip>
    );
  }
  return <>{fallback}</>;
};
