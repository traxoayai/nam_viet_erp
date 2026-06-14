import {
  PhoneOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Card,
  Descriptions,
  Typography,
  Space,
  Spin,
  Alert,
  Select,
  Tag,
} from "antd";
import dayjs from "dayjs";
import React, { useMemo } from "react";

const { Text } = Typography;
const { Option } = Select;

interface ShippingInfoProps {
  partner: unknown;
  supplierLeadTime: number;
  loading: boolean;
  error?: string;
  shippingType: string;
  onShippingTypeChange: (val: string) => void;
}

export const ShippingInfoCard: React.FC<ShippingInfoProps> = ({
  partner,
  supplierLeadTime,
  loading,
  error,
  shippingType,
  onShippingTypeChange,
}) => {
  const expectedDeliveryDate = useMemo(() => {
    if (!partner || !partner.cut_off_time) return null;

    // Logic: cut_off_time + lead_time (ngày) + 3 giờ
    // Giả sử cut_off_time là dạng HH:mm:ss
    const today = dayjs().startOf("day");
    const cutOffParts = partner.cut_off_time.split(":");
    let baseDate = today
      .add(parseInt(cutOffParts[0] || "0"), "hour")
      .add(parseInt(cutOffParts[1] || "0"), "minute");

    // Thêm lead time (số ngày)
    baseDate = baseDate.add(supplierLeadTime || 0, "day");

    // Thêm 3h vận chuyển nội bộ
    baseDate = baseDate.add(3, "hour");

    // Nếu thời gian dự kiến nằm trong quá khứ, đẩy sang ngày tiếp theo tương ứng
    if (baseDate.isBefore(dayjs())) {
      baseDate = baseDate.add(1, "day");
    }

    return baseDate;
  }, [partner, supplierLeadTime]);

  if (error) {
    return <Alert type="error" message="Lỗi" description={error} showIcon />;
  }

  return (
    <Card
      title="Thông tin Vận chuyển"
      size="small"
      style={{ height: "100%", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
      extra={loading ? <Spin size="small" /> : null}
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
          Hình thức giao hàng:
        </Text>
        <Select
          style={{ width: "100%" }}
          value={shippingType}
          onChange={onShippingTypeChange}
          disabled={!partner}
        >
          <Option value="app">Qua Ứng dụng (App)</Option>
          <Option value="chành xe">Chành xe</Option>
          <Option value="trực tiếp">Trực tiếp</Option>
          <Option value="đường bưu điện">Đường Bưu điện</Option>
        </Select>
      </div>

      {!partner && !loading && (
        <div style={{ textAlign: "center", color: "#999", padding: "10px 0" }}>
          Vui lòng chọn ĐVVC
        </div>
      )}

      {partner ? (
        <Descriptions column={1} size="small" labelStyle={{ color: "#8c8c8c" }}>
          <Descriptions.Item label="Đơn vị Vận chuyển">
            <Text strong>{partner.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Người liên hệ">
            <Space>
              <UserOutlined />
              <Text>{partner.contact_person || "---"}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">
            <Space>
              <PhoneOutlined />
              <Text>{partner.phone || "---"}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Nơi nhận hàng">
            <Space align="start">
              <EnvironmentOutlined style={{ marginTop: 4 }} />
              <Text>{partner.address || "---"}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Giờ cuối nhận hàng">
            <Tag color="magenta">{partner.cut_off_time || "---"}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="TG Kho nhận dự kiến">
            {expectedDeliveryDate ? (
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                {expectedDeliveryDate.format("DD/MM/YYYY HH:mm")}
              </Tag>
            ) : (
              <Text type="secondary">Chưa xác định</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Card>
  );
};
