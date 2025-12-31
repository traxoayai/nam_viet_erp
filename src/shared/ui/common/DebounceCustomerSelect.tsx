// src/shared/ui/common/DebounceCustomerSelect.tsx
import { UserOutlined } from "@ant-design/icons";
import { Select, Spin, Avatar, Typography, Empty } from "antd";
import React, { useEffect, useState } from "react";

import { useDebounce } from "@/shared/hooks/useDebounce";
import { salesService } from "@/features/sales/api/salesService"; // Dùng service mới

interface DebounceCustomerSelectProps {
  value?: any;
  // AURA FIX: Sửa type onChange để chấp nhận 2 tham số
  onChange?: (value: any, option?: any) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const DebounceCustomerSelect: React.FC<DebounceCustomerSelectProps> = ({
  value,
  onChange,
  placeholder = "Tìm kiếm khách hàng (Tên, SĐT)...",
  style,
}) => {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchOptions = async (keyword: string) => {
    setFetching(true);
    try {
      // Gọi API B2B Search mới
      const data = await salesService.searchCustomers(keyword);

      const formattedOptions = data.map((c: any) => ({
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
            }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ backgroundColor: "#87d068" }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <Typography.Text strong>{c.name}</Typography.Text>
              <div style={{ fontSize: 11, color: "#666" }}>
                MST: {c.tax_code} | {c.phone}
              </div>
            </div>
          </div>
        ),
        value: c.id,
        customer: c, // Đính kèm full object để dùng ở ngoài
      }));
      setOptions(formattedOptions);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (debouncedSearch) fetchOptions(debouncedSearch);
  }, [debouncedSearch]);

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={setSearchQuery}
      notFoundContent={
        fetching ? (
          <Spin size="small" />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy"
          />
        )
      }
      options={options}
      value={value}
      onChange={onChange} // Giờ đã khớp Type
      placeholder={placeholder}
      style={style}
      loading={fetching}
      allowClear
    />
  );
};

export default DebounceCustomerSelect;
