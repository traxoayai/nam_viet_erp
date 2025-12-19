// src/components/shared/listing/SmartTable.tsx
import { InboxOutlined } from "@ant-design/icons";
import { Table, TableProps } from "antd";
import React from "react"; // Thêm React

interface Props<T> extends TableProps<T> {
  emptyText?: string;
}

// Helper component để React.memo hoạt động tốt với Generic Type
const SmartTableInner = <T extends object>({
  emptyText,
  ...rest
}: Props<T>) => {
  return (
    <div style={{ background: "#fff", borderRadius: "0 0 8px 8px" }}>
      <Table
        {...rest}
        rowKey={(record: any) => record.key || record.id}
        size="middle"
        locale={{
          emptyText: (
            <div style={{ padding: 40, textAlign: "center" }}>
              <InboxOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />
              <p style={{ color: "#888", marginTop: 12 }}>
                {emptyText || "Không có dữ liệu"}
              </p>
            </div>
          ),
        }}
        scroll={{ x: "max-content" }}
      />
    </div>
  );
};

// Áp dụng React.memo
export const SmartTable = React.memo(SmartTableInner) as typeof SmartTableInner;
