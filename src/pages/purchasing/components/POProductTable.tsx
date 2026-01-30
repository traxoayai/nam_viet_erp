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
  Checkbox, // [NEW]
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
    // Ưu tiên hiển thị giá trị đang chọn
    const currentValue = item.uom; 

    return (
      <Select
        value={currentValue}
        style={{ width: "100%" }}
        popupMatchSelectWidth={false} // Để dropdown không bị cắt chữ nếu dài
        onChange={(val) => {
          // 1. Cập nhật đơn vị mới cho State
          onItemChange(idx, "uom", val);
          
          // 2. [Optional] Tìm unit trong mảng để cập nhật giá gợi ý (nếu cần)
          // const selectedUnit = item.available_units?.find(u => u.unit_name === val);
          // if (selectedUnit && selectedUnit.price_sell) {
          //    onItemChange(idx, "unit_price", selectedUnit.price_sell); 
          // }
        }}
      >
        {/* LOGIC MỚI: Render từ mảng available_units trả về từ API */}
        {item.available_units && item.available_units.length > 0 ? (
          item.available_units.map((u) => (
            <Option key={u.id} value={u.unit_name}>
              {u.unit_name} {u.conversion_rate > 1 ? `(x${u.conversion_rate})` : ''}
            </Option>
          ))
        ) : (
          /* Fallback cho dữ liệu cũ (Legacy) */
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
          disabled={r.is_bonus} // [NEW] Disable price if bonus
        />
      ),
    },
    {
       title: "Hàng tặng", // [NEW] Bonus Column
       width: 90,
       align: 'center' as const,
       render: (_: any, r: POItem, idx: number) => (
         <Checkbox 
           checked={r.is_bonus}
           onChange={(e) => {
               const val = e.target.checked;
               onItemChange(idx, "is_bonus", val);
               if (val) onItemChange(idx, "unit_price", 0);
           }}
         />
       )
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
