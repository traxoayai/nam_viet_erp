import { BankOutlined, PhoneOutlined, UserOutlined } from "@ant-design/icons";
import {
  Card,
  Descriptions,
  Typography,
  Space,
  Spin,
  Alert,
  Input,
} from "antd";
import React from "react";

const { Text } = Typography;
const { TextArea } = Input;

interface SupplierInfoProps {
  supplier: any;
  loading: boolean;
  error?: string;
  note: string;
  onNoteChange: (val: string) => void;
  /**
   * Công nợ NCC lấy từ `supplier_debt_view` (single source of truth).
   * Caller nên truyền số này (qua `financeService.getSupplierDebt`) để mọi UI
   * công nợ NCC hiển thị đồng nhất; nếu omit, fallback về `supplier.current_debt`
   * giữ tương thích ngược cho các flow cũ.
   */
  currentDebt?: number | null;
}

export const SupplierInfoCard: React.FC<SupplierInfoProps> = ({
  supplier,
  loading,
  error,
  note,
  onNoteChange,
  currentDebt,
}) => {
  // Ưu tiên prop currentDebt (đã đi qua view); fallback về supplier.current_debt
  // để 2 V2 page chưa migrate vẫn chạy được.
  const debtToShow =
    currentDebt !== undefined && currentDebt !== null
      ? Number(currentDebt)
      : Number(supplier?.current_debt ?? 0);
  if (error) {
    return <Alert type="error" message="Lỗi" description={error} showIcon />;
  }

  return (
    <Card
      title="Thông tin Nhà cung cấp"
      size="small"
      style={{ height: "100%", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
      extra={loading ? <Spin size="small" /> : null}
    >
      {!supplier && !loading && (
        <div style={{ textAlign: "center", color: "#999", padding: "20px 0" }}>
          Vui lòng chọn Nhà cung cấp
        </div>
      )}

      {supplier ? (
        <Descriptions column={1} size="small" labelStyle={{ color: "#8c8c8c" }}>
          <Descriptions.Item label="Tên NCC">
            <Text strong>{supplier.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">
            <Text>{supplier.tax_code || "---"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Người liên hệ">
            <Space>
              <UserOutlined style={{ color: "#1890ff" }} />
              <Text>{supplier.contact_person || "---"}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            <Space>
              <PhoneOutlined style={{ color: "#52c41a" }} />
              <Text>{supplier.phone || "---"}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Nợ hiện tại">
            <Space>
              <BankOutlined style={{ color: "#faad14" }} />
              <Text strong type="danger">
                {new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(debtToShow)}
              </Text>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      ) : null}

      {supplier ? (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            Ghi chú vận chuyển:
          </Text>
          <TextArea
            rows={2}
            placeholder="Nhập ghi chú cho nhà cung cấp ..."
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </div>
      ) : null}
    </Card>
  );
};
