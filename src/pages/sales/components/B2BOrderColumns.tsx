// src/pages/sales/components/B2BOrderColumns.tsx
import { UserOutlined } from "@ant-design/icons";
import { Tag, Badge, Typography, Space } from "antd";

import { B2BOrderItem } from "@/features/sales/types/b2b.types"; // Import Type từ Nexus
// Import Utils từ Nexus
import {
  B2B_STATUS_COLOR,
  B2B_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
} from "@/shared/utils/b2bConstants";

const { Text } = Typography;

export const B2BOrderColumns = [
  {
    title: "Mã đơn",
    dataIndex: "code",
    width: 120,
    render: (code: string) => (
      <Text strong style={{ color: "#1890ff" }}>
        {code}
      </Text>
    ),
  },
  {
    title: "Khách hàng",
    dataIndex: "customer_name",
    width: 200,
    render: (name: string) => (
      <Space>
        <UserOutlined style={{ color: "#888" }} />
        <Text>{name}</Text>
      </Space>
    ),
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    width: 140,
    render: (status: keyof typeof B2B_STATUS_LABEL) => (
      // Map màu và text từ Utils của Nexus
      <Tag color={B2B_STATUS_COLOR[status] || "default"}>
        {B2B_STATUS_LABEL[status] || status}
      </Tag>
    ),
  },
  {
    title: "Thanh toán",
    dataIndex: "payment_status",
    width: 160,
    render: (stt: keyof typeof PAYMENT_STATUS_COLOR) => (
      // Yêu cầu của Core: Hiển thị Badge chấm tròn
      <Badge
        status={(PAYMENT_STATUS_COLOR[stt] as any) || "default"}
        text={stt?.toUpperCase()}
      />
    ),
  },
  {
    title: "Tổng tiền",
    dataIndex: "final_amount",
    align: "right" as const,
    render: (val: number, record: B2BOrderItem) => {
      // Mệnh lệnh Stratos: Tô đỏ nếu chưa thanh toán
      const isUnpaid = record.payment_status === "unpaid";
      return (
        <Text strong style={{ color: isUnpaid ? "#cf1322" : undefined }}>
          {val?.toLocaleString()} ₫
        </Text>
      );
    },
  },
  {
    title: "Ngày tạo",
    dataIndex: "created_at",
    align: "right" as const,
    width: 120,
    // (Optional) Format date nếu cần: dayjs(val).format('DD/MM/YYYY')
  },
];
