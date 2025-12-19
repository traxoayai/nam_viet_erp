// src/components/shared/listing/StandardPagination.tsx
import { Pagination } from "antd";

interface Props {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
}

export const StandardPagination = (props: Props) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "16px 24px",
        background: "#fff",
      }}
    >
      <Pagination
        {...props}
        showSizeChanger
        showQuickJumper
        showTotal={(total) => `Tổng ${total} mục`}
      />
    </div>
  );
};
