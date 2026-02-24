import { UserOutlined, ShopOutlined } from "@ant-design/icons";
import { Select, Spin, Tag, Empty, Avatar, Typography } from "antd";
import debounce from "lodash/debounce"; // Dùng lodash cho tiện với Select mode remote
import React, { useState, useMemo } from "react";

import { posService } from "@/features/pos/api/posService"; // API B2C
import { salesService } from "@/features/sales/api/salesService"; // API B2B

const { Text } = Typography;

export interface CustomerOption {
  key: string;
  label: React.ReactNode;
  value: number; // ID khách hàng
  type: "B2B" | "B2C";
  rawName: string; // Tên dạng text để hiển thị khi đã chọn
  item: any; // Add item to interface
}

interface Props {
  value?: any[];
  onChange?: (value: any[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const UniversalCustomerSelect: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "Tìm khách lẻ (POS) hoặc Nhà thuốc (B2B)...",
  style,
}) => {
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [fetching, setFetching] = useState(false);

  // Hàm tìm kiếm gộp (Debounce 500ms)
  const fetchCustomers = useMemo(
    () =>
      debounce(async (search: string) => {
        if (!search.trim()) {
          setOptions([]);
          return;
        }
        setFetching(true);

        try {
          // Gọi song song 2 API
          const [b2bData, b2cData] = await Promise.all([
            salesService.searchCustomers(search).catch(() => []), // Catch lỗi để không chặn luồng kia
            posService.searchCustomers(search).catch(() => []),
          ]);

          // Map B2B (Nhà thuốc/Đại lý)
          const b2bOptions = b2bData.map(
            (c: any): CustomerOption => ({
              key: `B2B_${c.id}`, // Key unique để tránh trùng ID giữa 2 bảng
              value: c.id,
              type: "B2B",
              rawName: c.name,
              label: (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <Avatar
                      size="small"
                      icon={<ShopOutlined />}
                      style={{ backgroundColor: "#eb2f96" }}
                    />
                    <div>
                      <Text strong>{c.name}</Text>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {c.phone} | MST: {c.tax_code}
                      </div>
                    </div>
                  </div>
                  <Tag color="magenta">Đại lý</Tag>
                </div>
              ),
              item: { type: "B2B", ...c }, // Lưu data gốc để Form sử dụng
            })
          );

          // Map B2C (Khách lẻ)
          const b2cOptions = b2cData.map(
            (c: any): CustomerOption => ({
              key: `B2C_${c.id}`,
              value: c.id,
              type: "B2C",
              rawName: c.name,
              label: (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <Avatar
                      size="small"
                      icon={<UserOutlined />}
                      style={{ backgroundColor: "#1890ff" }}
                    />
                    <div>
                      <Text strong>{c.name}</Text>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {c.phone}
                      </div>
                    </div>
                  </div>
                  <Tag color="blue">Khách lẻ</Tag>
                </div>
              ),
              item: { type: "B2C", ...c },
            })
          );

          // Gộp lại (B2B trước, B2C sau hoặc tùy ý)
          setOptions([...b2bOptions, ...b2cOptions]);
        } catch (err) {
          console.error("Search Error:", err);
        } finally {
          setFetching(false);
        }
      }, 500),
    []
  );

  return (
    <Select
      mode="multiple" // Cho phép chọn nhiều người để tặng Voucher hàng loạt
      labelInValue // Quan trọng: Trả về Object {value, label, item} thay vì chỉ value
      value={value}
      placeholder={placeholder}
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
      filterOption={false}
      onSearch={fetchCustomers}
      onChange={onChange}
      style={{ width: "100%", ...style }}
      optionLabelProp="children" // Hiển thị custom render khi dropdown mở
    >
      {options.map((opt) => (
        <Select.Option key={opt.key} value={opt.value} item={opt.item}>
          {opt.label}
        </Select.Option>
      ))}
    </Select>
  );
};

export default UniversalCustomerSelect;
