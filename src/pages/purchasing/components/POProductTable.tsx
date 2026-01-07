// src/pages/purchasing/components/POProductTable.tsx
import { DeleteOutlined } from "@ant-design/icons";
import {
  Table,
  Card,
  Button,
  InputNumber,
  Select,
  Space,
  Typography,
  Grid,
  Avatar,
  Form,
} from "antd";
import React from "react";

// FIX: Import POItem để định nghĩa kiểu dữ liệu chính xác
import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";

const { useBreakpoint } = Grid;
const { Text } = Typography;
const { Option } = Select;

interface Props {
  items: POItem[];
  // FIX: Định nghĩa field là 'keyof POItem' thay vì string
  onItemChange: (index: number, field: keyof POItem, value: any) => void;
  onRemove: (index: number) => void;
}

const POProductTable: React.FC<Props> = ({ items, onItemChange, onRemove }) => {
  const screens = useBreakpoint();

  // Helper: Render Unit Select (Shared between Mobile & Desktop)
  const renderUnitSelect = (item: POItem, idx: number) => {
    // [FIX]: Nếu item.uom bị rỗng, thử lấy đơn vị đầu tiên trong danh sách làm mặc định
    // Hoặc ưu tiên lấy đơn vị Sỉ (_wholesale_unit)
    const displayValue = item.uom || item._wholesale_unit || (item.available_units?.[0]?.unit_name);

    return (
      <Select
        value={displayValue} // Dùng giá trị đã fix
        style={{ width: "100%" }}
        onChange={(val) => {
          // 1. Cập nhật đơn vị mới
          onItemChange(idx, "uom", val);
          
          // 2. [Optional] Auto-update price logic if needed later
        }}
      >
        {/* Ưu tiên dùng available_units nếu có */}
        {item.available_units && item.available_units.length > 0 ? (
          item.available_units.map((u) => (
            <Option key={u.unit_name} value={u.unit_name}>
              {u.unit_name} {u.conversion_rate > 1 ? `(x${u.conversion_rate})` : ''}
            </Option>
          ))
        ) : (
          /* Fallback cho dữ liệu cũ */
          <>
            <Option value={item._wholesale_unit}>{item._wholesale_unit}</Option>
            {item._retail_unit && item._retail_unit !== item._wholesale_unit && (
               <Option value={item._retail_unit}>{item._retail_unit}</Option>
            )}
          </>
        )}
      </Select>
    );
  };

  // --- RENDER MOBILE VIEW (CARD LIST) ---
  if (!screens.md) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, idx) => (
          <Card
            key={item.product_id}
            size="small"
            styles={{ body: { padding: 12 } }}
          >
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Avatar shape="square" size={64} src={item.image_url} />
              <div style={{ flex: 1 }}>
                <Text strong>{item.name}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.sku}
                  </Text>
                </div>
              </div>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onRemove(idx)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <Form.Item label="ĐVT" style={{ marginBottom: 0 }}>
                 {renderUnitSelect(item, idx)}
              </Form.Item>

              <Form.Item label="SL" style={{ marginBottom: 0 }}>
                <InputNumber
                  value={item.quantity}
                  min={1}
                  style={{ width: "100%" }}
                  onChange={(val) => onItemChange(idx, "quantity", val)}
                />
              </Form.Item>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <InputNumber
                value={item.unit_price}
                style={{ width: 120 }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) =>
                  v!.replace(/\$\s?|(,*)/g, "") as unknown as number
                }
                onChange={(val) => onItemChange(idx, "unit_price", val)}
                addonAfter="₫"
              />
              <Text strong style={{ fontSize: 16, color: "#1677ff" }}>
                {(item.quantity * item.unit_price).toLocaleString()} ₫
              </Text>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            Chưa có sản phẩm
          </div>
        )}
      </div>
    );
  }

  // --- RENDER DESKTOP VIEW (TABLE) ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      width: 300,
      render: (_: any, r: POItem) => (
        <Space>
          <Avatar shape="square" size={48} src={r.image_url} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{r.sku}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "ĐVT",
      width: 120,
      render: (_: any, r: POItem, idx: number) => renderUnitSelect(r, idx),
    },
    {
      title: "Số lượng",
      width: 100,
      render: (_: any, r: POItem, idx: number) => (
        <InputNumber
          value={r.quantity}
          min={1}
          style={{ width: "100%" }}
          onChange={(val) => onItemChange(idx, "quantity", val)}
        />
      ),
    },
    {
      title: "Đơn giá",
      width: 150,
      render: (_: any, r: POItem, idx: number) => (
        <InputNumber
          value={r.unit_price}
          style={{ width: "100%" }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          parser={(v) => v!.replace(/\$\s?|(,*)/g, "") as unknown as number}
          onChange={(val) => onItemChange(idx, "unit_price", val)}
          addonAfter="₫"
        />
      ),
    },
    {
      title: "Thành tiền",
      align: "right" as const,
      width: 150,
      render: (_: any, r: POItem) => (
        <Text strong>{(r.quantity * r.unit_price).toLocaleString()} ₫</Text>
      ),
    },
    {
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(idx)}
        />
      ),
    },
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      rowKey="product_id"
      pagination={false}
      scroll={{ y: 500 }}
    />
  );
};

export default React.memo(POProductTable);
