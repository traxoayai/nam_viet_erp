// src/features/pos/components/PosCartTable.tsx
import { DeleteOutlined, PrinterOutlined } from "@ant-design/icons";
import {
  Table,
  Avatar,
  Tag,
  Space,
  Select,
  InputNumber,
  Button,
  Tooltip,
  Typography,
  message,
} from "antd";

import { usePosCartStore } from "../stores/usePosCartStore";
import { CartItem } from "../types/pos.types";
import { printInstruction } from "@/shared/utils/printTemplates";

const { Text } = Typography;

export const PosCartTable = () => {
  const { updateQuantity, updateItemField, removeFromCart, getCurrentOrder } =
    usePosCartStore();
  const currentOrder = getCurrentOrder();
  const items = currentOrder?.items || [];

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      width: 350,
      render: (_: any, r: CartItem) => (
        <Space align="center" size="middle">
          <Avatar
            shape="circle"
            src={r.image_url}
            size={56}
            style={{ backgroundColor: "#f0f2f5", border: "1px solid #e8e8e8" }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "#262626" }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
              <Tag
                color="blue"
                style={{ borderRadius: 4, marginRight: 8, padding: "0 8px" }}
              >
                {r.location?.cabinet
                  ? `${r.location.cabinet}-${r.location.row}`
                  : "Kho chính"}
              </Tag>
              <Text type="secondary">{r.sku}</Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Liều dùng / HDSD",
      dataIndex: "dosage",
      width: 320,
      render: (t: string, r: CartItem) => (
        <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
          <Select
            className="dosage-select-no-right-radius"
            showSearch
            allowClear
            value={t}
            style={{ flex: 1 }}
            size="large"
            placeholder="Ghi chú liều dùng..."
            onChange={(val) => updateItemField(r.id, "dosage", val)}
            options={[
              { value: "Sáng 1 - Tối 1", label: "💊 Sáng 1 - Tối 1" },
              {
                value: "Sáng 1 - Chiều 1 - Tối 1",
                label: "💊 Sáng 1 - Chiều 1 - Tối 1",
              },
              { value: "Uống khi đau/sốt", label: "⚠️ Uống khi đau/sốt" },
            ]}
            dropdownStyle={{ borderRadius: 8 }}
          />
          <Tooltip title="In HDSD">
            <Button
              size="large"
              icon={<PrinterOutlined />}
              type="primary"
              style={{
                width: 48,
                flexShrink: 0,
                borderRadius: "0 8px 8px 0",
                marginLeft: -1, // Overlap border
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#52c41a",
                borderColor: "#52c41a",
                zIndex: 1
              }}
              onClick={() => {
                if (!t) return message.warning("Chưa nhập liều dùng!");
                printInstruction(r.name, t);
              }}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 100,
      align: "center" as const,
      render: (u: string) => (
        <Tag color="cyan" style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, fontWeight: 500 }}>
          {u}
        </Tag>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "qty",
      width: 120,
      align: "center" as const,
      render: (v: number, r: CartItem) => (
        <InputNumber
          min={1}
          max={r.stock_quantity}
          value={v}
          size="large"
          style={{ width: "100%", borderRadius: 8 }}
          onChange={(val) => updateQuantity(r.id, val || 1)}
        />
      ),
    },
    {
      title: "Thành tiền",
      width: 140,
      align: "center" as const,
      render: (_: any, r: CartItem) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Text strong style={{ fontSize: 16, color: "#fa541c" }}>
            {(r.price * r.qty).toLocaleString()}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.price.toLocaleString()} / {r.unit}
          </Text>
        </div>
      ),
    },
    {
      width: 60,
      align: "center" as const,
      render: (_: any, r: CartItem) => (
        <Button
          type="text"
          size="large"
          danger
          icon={<DeleteOutlined style={{ fontSize: 18 }} />}
          onClick={() => removeFromCart(r.id)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderRadius: 8,
            width: 40,
            height: 40
          }}
          className="hover-danger-bg"
        />
      ),
    },
  ];

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      borderRadius: 12, 
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden'
    }}>
      <Table
        dataSource={items}
        columns={columns}
        pagination={false}
        scroll={{ y: "calc(100vh - 420px)" }}
        size="large"
        rowKey="id"
        style={{ flex: 1 }}
        locale={{ emptyText: "👉 Bấm F2 để tìm thuốc hoặc quét mã vạch" }}
      />
    </div>
  );
};

