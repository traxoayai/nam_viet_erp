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
import { POItem } from "@/types/purchaseOrderTypes";

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
                <Select
                  value={item.uom}
                  onChange={(val) => onItemChange(idx, "uom", val)}
                  size="middle"
                >
                  <Option value={item._wholesale_unit}>
                    {item._wholesale_unit}
                  </Option>
                  {item._retail_unit &&
                  item._retail_unit !== item._wholesale_unit ? (
                    <Option value={item._retail_unit}>
                      {item._retail_unit}
                    </Option>
                  ) : null}
                </Select>
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
      render: (_: any, r: POItem, idx: number) => (
        <Select
          value={r.uom}
          style={{ width: "100%" }}
          onChange={(val) => onItemChange(idx, "uom", val)}
        >
          <Option value={r._wholesale_unit}>{r._wholesale_unit}</Option>
          {r._retail_unit && r._retail_unit !== r._wholesale_unit ? (
            <Option value={r._retail_unit}>{r._retail_unit}</Option>
          ) : null}
        </Select>
      ),
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
