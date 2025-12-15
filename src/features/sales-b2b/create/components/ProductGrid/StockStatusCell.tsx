// src/features/sales-b2b/create/components/ProductGrid/StockStatusCell.tsx
import { WarningOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Tooltip, Tag } from "antd";

interface Props {
  stock: number;
  ordered: number;
  unit: string;
}

export const StockStatusCell = ({ stock, ordered, unit }: Props) => {
  const isShortage = ordered > stock;

  if (isShortage) {
    return (
      <Tooltip title={`Thiếu hàng! Trong kho chỉ còn ${stock} ${unit}`}>
        <Tag color="error" icon={<WarningOutlined />}>
          {stock.toLocaleString()} (Thiếu {ordered - stock})
        </Tag>
      </Tooltip>
    );
  }

  return (
    <span style={{ color: stock > 0 ? "green" : "red", fontSize: 12 }}>
      {stock > 0 ? <CheckCircleOutlined /> : <WarningOutlined />} Tồn:{" "}
      <b>{stock.toLocaleString()}</b> {unit}
    </span>
  );
};
