// src/features/sales-b2b/create/components/Header/ShippingForm.tsx
import { CarOutlined, ClockCircleOutlined } from "@ant-design/icons"; // Thêm icon
import { Select, Input, Row, Col, Typography } from "antd";
import { useEffect } from "react";

// QUAN TRỌNG: AURA sử dụng tài nguyên do NEXUS cung cấp
import { useShippingPartnerStore } from "@/features/partners/stores/useShippingPartnerStore";
import { DELIVERY_METHODS } from "@/shared/constants/b2b";

const { Text } = Typography;

interface Props {
  deliveryMethod: "internal" | "app" | "coach";
  setDeliveryMethod: (val: any) => void;
  shippingPartnerId?: number;
  setShippingPartner: (id: number) => void;
  estimatedDeliveryText: string;
}

export const ShippingForm = ({
  deliveryMethod,
  setDeliveryMethod,
  shippingPartnerId,
  setShippingPartner,
  estimatedDeliveryText,
}: Props) => {
  const { partners, fetchPartners } = useShippingPartnerStore();

  useEffect(() => {
    if (partners.length === 0) fetchPartners({});
  }, []);

  // AURA: Logic hiển thị Placeholder dựa trên dữ liệu của NEXUS
  const getPartnerPlaceholder = () => {
    if (deliveryMethod === "app") return "Chọn Ứng dụng (Grab, Ahamove...)";
    if (deliveryMethod === "coach") return "Chọn Nhà xe / Chành xe";
    return "Chọn đối tác";
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Row gutter={12}>
        <Col span={10}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Hình thức giao hàng
          </div>
          <Select
            style={{ width: "100%" }}
            value={deliveryMethod}
            onChange={setDeliveryMethod}
            // AURA: Map dữ liệu từ NEXUS vào UI Component
            options={DELIVERY_METHODS.map((m) => ({
              label: m.label,
              value: m.value,
            }))}
          />
        </Col>

        <Col span={14}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Thông tin vận chuyển
          </div>

          {deliveryMethod === "internal" ? (
            <Input
              disabled
              placeholder="Đội giao hàng nội bộ Nam Việt"
              prefix={<CarOutlined style={{ color: "#1890ff" }} />}
              style={{ color: "#333", fontWeight: 500 }}
            />
          ) : (
            <Select
              placeholder={getPartnerPlaceholder()}
              style={{ width: "100%" }}
              options={partners.map((p) => ({ label: p.name, value: p.id }))}
              value={shippingPartnerId}
              onChange={setShippingPartner}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          )}
        </Col>
      </Row>

      {/* Hiển thị thời gian dự kiến */}
      <div
        style={{
          marginTop: 8,
          background: "#f6ffed",
          border: "1px solid #b7eb8f",
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
        }}
      >
        <ClockCircleOutlined
          style={{ color: "#52c41a", marginRight: 8, fontSize: 14 }}
        />
        <Text type="success" strong>
          {estimatedDeliveryText}
        </Text>
      </div>
    </div>
  );
};
