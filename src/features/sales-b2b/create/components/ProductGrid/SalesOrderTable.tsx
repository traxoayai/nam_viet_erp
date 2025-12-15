// src/features/sales-b2b/create/components/ProductGrid/SalesOrderTable.tsx
import { DeleteOutlined, PictureOutlined } from "@ant-design/icons";
import {
  Table,
  InputNumber,
  Button,
  Avatar,
  Typography,
  Space,
  Tag,
} from "antd";

import { ProductSearchBar } from "./ProductSearchBar";
import { StockStatusCell } from "./StockStatusCell";

import { CartItem, ProductB2B } from "@/types/b2b_sales";

const { Text } = Typography;

interface Props {
  items: CartItem[];
  onAddItem: (product: ProductB2B) => void;
  onUpdateItem: (key: string, field: keyof CartItem, value: any) => void;
  onRemoveItem: (key: string) => void;
}

export const SalesOrderTable = ({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) => {
  const columns = [
    {
      title: "STT",
      width: 50,
      align: "center" as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Sản phẩm",
      width: 350,
      render: (_: any, r: CartItem) => (
        <Space align="start">
          <Avatar
            shape="square"
            size={48}
            src={r.image_url}
            icon={<PictureOutlined />}
            style={{ backgroundColor: r.image_url ? "transparent" : "#f0f0f0" }}
          />
          <div>
            <Text strong style={{ color: "#0050b3" }}>
              {r.name}
            </Text>
            <div style={{ fontSize: 12, color: "#666" }}>{r.sku}</div>
            <div style={{ fontSize: 11, color: "#888" }}>
              Lô: <b>{r.lot_number || "FIFO"}</b> | HD: {r.expiry_date || "--"}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Đơn vị",
      dataIndex: "wholesale_unit",
      align: "center" as const,
      width: 80,
      render: (u: string) => <Tag color="geekblue">{u}</Tag>,
    },
    {
      title: "Tồn kho",
      width: 140,
      render: (_: any, r: CartItem) => (
        <StockStatusCell
          stock={r.stock_quantity}
          ordered={r.quantity}
          unit={r.wholesale_unit}
        />
      ),
    },
    {
      title: "Số lượng",
      width: 100,
      render: (_: any, r: CartItem) => (
        <InputNumber
          min={1}
          value={r.quantity}
          onChange={(v) => onUpdateItem(r.key, "quantity", v || 1)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Đơn giá",
      dataIndex: "price_wholesale",
      align: "right" as const,
      width: 120,
      render: (val: number) => <Text>{val.toLocaleString()} ₫</Text>,
    },
    {
      title: "Chiết khấu",
      width: 110,
      render: (_: any, r: CartItem) => (
        <InputNumber
          min={0}
          value={r.discount}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
          onChange={(v) => onUpdateItem(r.key, "discount", v || 0)}
          style={{ width: "100%" }}
          placeholder="0"
        />
      ),
    },
    {
      title: "Thành tiền",
      align: "right" as const,
      width: 140,
      render: (_: any, r: CartItem) => (
        <Text strong>{r.total.toLocaleString()} ₫</Text>
      ),
    },
    {
      width: 50,
      align: "center" as const,
      render: (_: any, r: CartItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemoveItem(r.key)}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        border: "1px solid #f0f0f0",
      }}
    >
      {/* Search Bar tích hợp ngay trên bảng */}
      <ProductSearchBar onSelect={onAddItem} />

      <Table
        dataSource={items}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="small"
        locale={{ emptyText: "Chưa có sản phẩm nào. Hãy tìm kiếm để thêm." }}
        summary={(pageData) => {
          let totalQty = 0;
          let totalAmount = 0;
          pageData.forEach(({ quantity, total }) => {
            totalQty += quantity;
            totalAmount += total;
          });
          return (
            <Table.Summary.Row style={{ background: "#fafafa" }}>
              <Table.Summary.Cell index={0} colSpan={4}>
                <strong>TỔNG CỘNG</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <strong>{totalQty}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={4} align="right">
                <strong style={{ fontSize: 16, color: "#0050b3" }}>
                  {totalAmount.toLocaleString()} ₫
                </strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
    </div>
  );
};
