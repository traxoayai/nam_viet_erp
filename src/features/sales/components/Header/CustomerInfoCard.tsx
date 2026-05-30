// src/features/sales-b2b/create/components/Header/CustomerInfoCard.tsx
import {
  UserOutlined,
  TrophyOutlined,
  AlertOutlined,
  EnvironmentOutlined,
  CreditCardOutlined,
  CloseOutlined,
  PhoneOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import {
  Card,
  Row,
  Col,
  Typography,
  Avatar,
  Tag,
  Space,
  Button,
  Descriptions,
  Input,
} from "antd";

import { CustomerB2B } from "@/features/sales/types/b2b_sales";

const { Text, Title } = Typography;

interface Props {
  customer: CustomerB2B;
  onClear: () => void;
  currentDebt: number;
  newDebt: number;
  isOverLimit: boolean;
  note: string;
  setNote: (note: string) => void;
}

export const CustomerInfoCard = ({
  customer,
  onClear,
  currentDebt,
  newDebt,
  isOverLimit,
  note,
  setNote,
}: Props) => {
  // Lấy người liên hệ chính (hoặc người đầu tiên)
  const contacts = customer.contacts || [];
  const primaryContact =
    contacts.find((c) => c.is_primary) || contacts[0];

  return (
    <Card
      size="small"
      style={{ borderTop: "3px solid #1890ff", background: "#fff" }}
      bodyStyle={{ padding: "16px" }}
    >
      <Row gutter={24}>
        {/* CỘT TRÁI: THÔNG TIN CHI TIẾT (65%) */}
        <Col span={16} style={{ borderRight: "1px dashed #f0f0f0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Space align="start">
              <Avatar
                shape="square"
                size={54}
                icon={<UserOutlined />}
                style={{ backgroundColor: "#e6f7ff", color: "#1890ff" }}
              />
              <div>
                <Title level={5} style={{ margin: 0, color: "#0050b3" }}>
                  {customer.name}
                </Title>
                <Space size="small" style={{ marginTop: 4 }}>
                  <Tag icon={<CreditCardOutlined />} color="blue">
                    {customer.tax_code || "Chưa có MST"}
                  </Tag>
                  <Tag icon={<TrophyOutlined />} color="gold">
                    {customer.loyalty_points ?? 0} điểm
                  </Tag>
                </Space>
              </div>
            </Space>
          </div>

          <Descriptions
            column={1}
            size="small"
            colon={false}
            contentStyle={{ fontWeight: 500 }}
          >
            <Descriptions.Item
              label={
                <span
                  style={{ color: "#888", width: 110, display: "inline-block" }}
                >
                  <EnvironmentOutlined /> Xuất HĐ:
                </span>
              }
            >
              {customer.vat_address || "---"}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span
                  style={{ color: "#888", width: 110, display: "inline-block" }}
                >
                  <SolutionOutlined /> Người nhận:
                </span>
              }
            >
              {primaryContact ? (
                <span>
                  {primaryContact.name}{" "}
                  <Tag style={{ marginLeft: 8 }}>
                    <PhoneOutlined /> {primaryContact.phone}
                  </Tag>
                </span>
              ) : (
                "---"
              )}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span
                  style={{ color: "#888", width: 110, display: "inline-block" }}
                >
                  <EnvironmentOutlined style={{ color: "red" }} /> Giao hàng:
                </span>
              }
            >
              {customer.shipping_address || "---"}
            </Descriptions.Item>
          </Descriptions>
        </Col>

        {/* CỘT PHẢI: TÀI CHÍNH & CÔNG NỢ (35%) */}
        <Col span={8}>
          <div
            style={{
              background: isOverLimit ? "#fff1f0" : "#f6ffed",
              padding: 12,
              borderRadius: 6,
              border: isOverLimit ? "1px solid #ffccc7" : "1px solid #b7eb8f",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text type="secondary">Hạn mức:</Text>
              <Text strong>{customer.debt_limit.toLocaleString()} ₫</Text>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text type="secondary">Đang nợ:</Text>
              <Text>{Number(currentDebt || 0).toLocaleString()} ₫</Text>
            </div>

            <div
              style={{ margin: "8px 0", borderTop: "1px dashed #d9d9d9" }}
            ></div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text strong>Dư nợ sau đơn:</Text>
              <Text
                type={isOverLimit ? "danger" : "success"}
                strong
                style={{ fontSize: 15 }}
              >
                {(Number(currentDebt || 0) + Number(newDebt || 0)).toLocaleString()} ₫
              </Text>
            </div>

            {isOverLimit ? (
              <div
                style={{
                  marginTop: 8,
                  color: "#cf1322",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: "bold",
                }}
              >
                <AlertOutlined /> CẢNH BÁO: VƯỢT HẠN MỨC!
              </div>
            ) : null}
          </div>

          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={onClear}
            >
              Chọn khách khác
            </Button>
          </div>
        </Col>
      </Row>

      {/* KHỐI GHI CHÚ */}
      <div style={{ marginTop: 16 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 4 }}>
          Ghi chú đơn hàng:
        </Typography.Text>
        <Input.TextArea
          placeholder="Nhập ghi chú (VD: giao giờ hành chính)..."
          rows={2}
          value={note}
          onChange={(e: any) => setNote(e.target.value)}
        />
      </div>
    </Card>
  );
};
