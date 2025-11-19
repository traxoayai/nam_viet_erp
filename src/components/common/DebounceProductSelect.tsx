// src/components/common/DebounceProductSelect.tsx
import {
  SearchOutlined,
  MedicineBoxOutlined,
  CustomerServiceOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import { Select, Spin, Avatar, Typography, Empty, Tag } from "antd";
import React, { useState, useEffect } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import { searchProductsForDropdown } from "@/services/productService";

const { Text } = Typography;

// interface ProductOption {
//   id: number;
//   sku: string;
//   name: string;
//   unit: string;
//   price: number;
//   retail_price: number;
//   image: string | null;
//   type: "product" | "service" | "bundle";
// }

interface DebounceProductSelectProps {
  value?: any;
  onChange?: (value: any, option: any) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  // Thêm prop này để điều khiển tìm Gói hay không
  searchTypes?: string[]; // vd: ['service'] hoặc ['service', 'bundle']
}

const DebounceProductSelect: React.FC<DebounceProductSelectProps> = ({
  value,
  onChange,
  placeholder = "🔍 Tìm thuốc, vật tư hoặc dịch vụ...",
  style,
  searchTypes = ["service", "bundle"], // Mặc định tìm tất cả
}) => {
  const [options, setOptions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce 300ms
  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchOptions = async (keyword: string) => {
    setFetching(true);
    try {
      // Truyền searchTypes vào service
      const items = await searchProductsForDropdown(keyword, searchTypes);

      const formattedOptions = items.map((item: any) => ({
        label: (
          <div
            style={{ display: "flex", alignItems: "center", padding: "4px 0" }}
          >
            {/* Icon phân loại */}
            <div style={{ marginRight: 8 }}>
              {item.image ? (
                <Avatar src={item.image} shape="square" size="small" />
              ) : (
                <Avatar
                  style={{
                    backgroundColor:
                      item.type === "bundle"
                        ? "#722ed1"
                        : item.type === "service"
                          ? "#87d068"
                          : "#1890ff",
                  }}
                  icon={
                    item.type === "bundle" ? (
                      <GiftOutlined />
                    ) : item.type === "service" ? (
                      <CustomerServiceOutlined />
                    ) : (
                      <MedicineBoxOutlined />
                    )
                  }
                  shape="square"
                  size="small"
                />
              )}
            </div>

            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text strong style={{ fontSize: 13 }}>
                  {item.name}
                </Text>
                {item.type === "service" && (
                  <Tag color="green" style={{ marginRight: 0, fontSize: 10 }}>
                    Dịch vụ
                  </Tag>
                )}
                {item.type === "bundle" && (
                  <Tag color="purple" style={{ marginRight: 0, fontSize: 10 }}>
                    Combo
                  </Tag>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#666",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {item.sku} | {item.unit}
                </span>
                {/* Hiển thị giá bán nếu là Bundle/Service, giá vốn nếu là Product */}
                <Text type="secondary">
                  {item.type === "product" ? "Giá vốn: " : "Giá bán: "}
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(
                    item.type === "product" ? item.price : item.retail_price
                  )}
                </Text>
              </div>
            </div>
          </div>
        ),
        value: item.id,
        product: {
          // Map dữ liệu gốc
          id: item.id,
          name: item.name,
          sku: item.sku,
          retail_unit: item.unit,
          actual_cost: item.price,
          image_url: item.image,
          type: item.type, // Quan trọng để biết nó là gì
        },
      }));

      setOptions(formattedOptions);
    } finally {
      setFetching(false);
    }
  };

  // 1. Tìm kiếm khi gõ
  useEffect(() => {
    fetchOptions(debouncedSearch);
  }, [debouncedSearch]);

  // 2. FIX LỖI KHÓ CHỊU: Trigger tìm kiếm ngay khi click vào ô (Focus)
  const onFocus = () => {
    // Nếu danh sách đang rỗng, tải ngay gợi ý (từ khóa rỗng)
    if (options.length === 0) {
      fetchOptions("");
    }
  };

  return (
    <Select
      showSearch
      labelInValue={false}
      filterOption={false}
      onSearch={setSearchQuery}
      onFocus={onFocus} // <--- CHÌA KHÓA ĐỂ HIỆN GỢI Ý NGAY
      notFoundContent={
        fetching ? (
          <Spin size="small" />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy kết quả"
          />
        )
      }
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={style}
      suffixIcon={<SearchOutlined />}
      listHeight={256}
    />
  );
};

export default DebounceProductSelect;
