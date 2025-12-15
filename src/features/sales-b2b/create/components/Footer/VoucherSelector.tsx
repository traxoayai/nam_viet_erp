// src/features/sales-b2b/create/components/Footer/VoucherSelector.tsx
import { GiftOutlined } from "@ant-design/icons";
import { Select, Typography, Space, Tag, Empty } from "antd"; // Thêm Empty
import { useEffect, useState } from "react";

import { salesService } from "@/services/salesService";
import { VoucherRecord } from "@/types/b2b_sales";

const { Text } = Typography;

interface Props {
  customerId?: number;
  orderTotal: number;
  selectedVoucher: VoucherRecord | null;
  onSelect: (v: VoucherRecord | null) => void;
}

export const VoucherSelector = ({
  customerId,
  orderTotal,
  selectedVoucher,
  onSelect,
}: Props) => {
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerId && orderTotal > 0) {
      setLoading(true);
      salesService
        .getVouchers(customerId, orderTotal)
        .then(setVouchers)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setVouchers([]);
    }
  }, [customerId, orderTotal]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
        <GiftOutlined /> Chương trình khuyến mại
      </div>
      <Select
        style={{ width: "100%" }}
        // FIX: Chỉ disable khi chưa chọn khách, KHÔNG disable khi không có voucher
        disabled={!customerId}
        loading={loading}
        placeholder={
          !customerId
            ? "Chọn khách hàng trước"
            : vouchers.length
              ? "Chọn mã giảm giá..."
              : "Không có mã phù hợp"
        }
        allowClear
        value={selectedVoucher?.id}
        onChange={(_, option: any) => onSelect(option?.voucher || null)}
        options={vouchers.map((v) => ({
          label: (
            <Space>
              <Tag color="volcano">{v.code}</Tag>
              <Text>
                Giảm {v.discount_value.toLocaleString()}
                {v.discount_type === "percent" ? "%" : "đ"}
              </Text>
            </Space>
          ),
          value: v.id,
          voucher: v,
        }))}
        // FIX: Hiển thị giao diện "Trống" đẹp mắt nếu không có mã
        notFoundContent={
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có mã giảm giá nào"
          />
        }
      />
    </div>
  );
};
