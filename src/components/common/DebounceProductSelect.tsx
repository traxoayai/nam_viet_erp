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

interface DebounceProductSelectProps {
  value?: any;
  onChange?: (value: any, option: any) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  searchTypes?: string[]; // vd: ['service'] hoặc ['service', 'bundle']

  // --- TÍNH NĂNG MỚI: HÀM TÌM KIẾM TÙY CHỈNH ---
  // Cho phép truyền hàm tìm kiếm riêng (ví dụ: tìm hàng buôn) vào đây
  fetcher?: (keyword: string) => Promise<any[]>;
}

const DebounceProductSelect: React.FC<DebounceProductSelectProps> = ({
  value,
  onChange,
  placeholder = "🔍 Tìm thuốc, vật tư hoặc dịch vụ...",
  style,
  searchTypes = ["service", "bundle"], // Mặc định tìm tất cả
  fetcher, // Prop mới nhận hàm tìm kiếm
}) => {
  const [options, setOptions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce 300ms
  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchOptions = async (keyword: string) => {
    setFetching(true);
    try {
      let items = [];

      // LOGIC QUYẾT ĐỊNH DÙNG HÀM NÀO
      if (fetcher) {
        // Nếu có fetcher riêng (Trang Mua hàng) -> Dùng nó
        items = await fetcher(keyword);
      } else {
        // Nếu không (Trang POS, Voucher...) -> Dùng mặc định
        items = await searchProductsForDropdown(keyword, searchTypes);
      }

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

                {/* LOGIC HIỂN THỊ GIÁ THÔNG MINH */}
                <Text type="secondary">
                  {item.last_price > 0 ? (
                    // Nếu có giá nhập cũ (Trang Mua hàng) -> Hiện giá cũ
                    <span style={{ color: "#faad14" }}>
                      Giá cũ:{" "}
                      {new Intl.NumberFormat("vi-VN").format(item.last_price)}
                    </span>
                  ) : (
                    // Mặc định -> Hiện giá bán/giá vốn hiện tại
                    <>
                      {item.type === "product" ? "Giá vốn: " : "Giá bán: "}
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(
                        item.type === "product" ? item.price : item.retail_price
                      )}
                    </>
                  )}
                </Text>
              </div>
            </div>
          </div>
        ),
        value: item.id,
        product: item, // Trả về nguyên object đã map
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

  // 2. Trigger tìm kiếm ngay khi click vào ô (Focus)
  const onFocus = () => {
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
      onFocus={onFocus}
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
