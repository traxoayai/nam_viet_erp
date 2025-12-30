// src/features/pos/components/PosCartTable.tsx
import { Table, Avatar, Tag, Space, Input, Select, InputNumber, Button, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, PrinterOutlined } from "@ant-design/icons";
import { usePosCartStore } from "../stores/usePosCartStore";
import { CartItem } from "../types/pos.types";
import { printInstruction } from "@/shared/utils/printTemplates";

const { Text } = Typography;

export const PosCartTable = () => {
  const { items, updateQuantity, updateItemField, removeFromCart } = usePosCartStore();

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      width: 280,
      render: (_: any, r: CartItem) => (
        <Space align="start">
          <Avatar shape="square" src={r.image_url} size={48} style={{backgroundColor: '#f5f5f5'}} />
          <div>
            <div style={{fontWeight: 600, fontSize: 14}}>{r.name}</div>
            <div style={{ fontSize: 11, color: "#8c8c8c", marginTop: 2 }}>
              <Tag color="orange" style={{ marginRight: 4, padding: "0 4px", fontSize: 10 }}>
                {r.location.cabinet ? `${r.location.cabinet}-${r.location.row}` : 'Kho'}
              </Tag>
              {r.sku}
            </div>
          </div>
        </Space>
      ),
    },
    
    {
      title: "Liều dùng",
      dataIndex: "dosage",
      width: 200,
      render: (t: string, r: CartItem) => (
        <Input.Group compact>
          <Select
            allowClear
            value={t}
            style={{ width: "calc(100% - 32px)" }}
            size="small"
            placeholder="Chọn hoặc nhập liều..."
            onChange={(val) => updateItemField(r.id, "dosage", val)}
            options={[
                { value: "Sáng 1 - Tối 1", label: "Sáng 1 - Tối 1" },
                { value: "Sáng 1 - Chiều 1 - Tối 1", label: "Sáng 1 - Chiều 1 - Tối 1" },
                { value: "Uống khi đau/sốt", label: "Uống khi đau/sốt" }
            ]}
            mode="tags"
          />
          <Tooltip title="In HDSD để bấm vào vỉ">
            <Button
              size="small"
              icon={<PrinterOutlined />}
              style={{ width: 32, padding: 0, color: '#1890ff', borderColor: '#1890ff' }}
              onClick={() => {
                  if (!t) return message.warning("Chưa nhập liều dùng!");
                  printInstruction(r.name, t); // Calls the template function
              }}
            />
          </Tooltip>
        </Input.Group>
      ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 70,
      align: "center" as const,
      render: (u: string) => <Tag color="blue">{u}</Tag>,
    },
    {
      title: "SL",
      dataIndex: "qty",
      width: 80,
      align: "center" as const,
      render: (v: number, r: CartItem) => (
        <InputNumber
          min={1}
          max={r.stock_quantity} // Không cho nhập quá tồn
          value={v}
          size="small"
          style={{ width: "100%" }}
          onChange={(val) => updateQuantity(r.id, val || 1)}
        />
      ),
    },
    {
      title: "Thành tiền",
      width: 110,
      align: "right" as const,
      render: (_: any, r: CartItem) => (
        <Text strong>{(r.price * r.qty).toLocaleString()}</Text>
      ),
    },
    {
      width: 40,
      align: "center" as const,
      render: (_: any, r: CartItem) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeFromCart(r.id)}
        />
      ),
    },
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      pagination={false}
      scroll={{ y: "calc(100vh - 380px)" }} // Chiều cao động trừ đi header/footer
      size="small"
      rowKey="id"
      style={{ flex: 1 }}
      locale={{ emptyText: "Chưa có sản phẩm nào (F2 để tìm)" }}
    />
  );
};
