// src/features/booking/components/CustomerInfoCard.tsx
import {
  UserOutlined,
  CalendarOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { Alert, Space, Typography } from "antd";
import React from "react";

import { BookingCustomer } from "../hooks/useBookingResources";

import { calculateExactAge } from "@/shared/utils/dateUtils";

const { Text } = Typography;

interface CustomerInfoCardProps {
  customer: BookingCustomer | undefined;
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customer,
}) => {
  if (!customer) return null;

  const ageString = calculateExactAge(customer.dob);

  return (
    <Alert
      style={{ marginTop: 8 }}
      type="info"
      message={
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Space>
            <UserOutlined />
            <Text strong>{customer.name}</Text>
            <Text type="secondary">
              - {customer.gender || "Chưa cập nhật giới tính"}
            </Text>
          </Space>

          <Space>
            <CalendarOutlined />
            <Text>{ageString}</Text>
          </Space>

          <Space>
            <HomeOutlined />
            <Text>{customer.address || "Chưa cập nhật địa chỉ"}</Text>
          </Space>
        </div>
      }
    />
  );
};
