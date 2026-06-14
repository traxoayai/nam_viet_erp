// src/components/shared/listing/SmartTable.tsx
import { InboxOutlined } from "@ant-design/icons";
import { Table, TableProps } from "antd";
import React from "react"; // Thêm React

// Use any for TableProps spread to avoid generic variance issues
interface Props extends TableProps<unknown> {
  emptyText?: string;
}

// Helper component
export const SmartTable = ({
  emptyText,
  ...rest
}: Props) => {
  return (
    <div style={{ background: "#fff", borderRadius: "0 0 8px 8px" }}>
      <Table
        {...rest}
        rowKey={(record: unknown) =>
          ((record as Record<string, unknown>)?.key ||
            (record as Record<string, unknown>)?.id) as React.Key
        }
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
}
