// src/components/common/DebounceProductSelect.tsx
import {
  SearchOutlined,
  MedicineBoxOutlined,
  CustomerServiceOutlined,
  GiftOutlined,
} from "@ant-design/icons";
import { Select, Spin, Avatar, Typography, Empty, Tag } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import React, { useState, useEffect, useRef } from "react";

import { searchProductsForDropdown } from "@/features/product/api/productService";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Text } = Typography;

interface DebounceProductSelectProps {
  value?: unknown;
  onChange?: (value: unknown, option: unknown) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  searchTypes?: string[]; // vd: ['service'] hoặc ['service', 'bundle']

  // --- TÍNH NĂNG MỚI: HÀM TÌM KIẾM TÙY CHỈNH ---
  // Cho phép truyền hàm tìm kiếm riêng (ví dụ: tìm hàng buôn) vào đây
  fetcher?: (keyword: string) => Promise<Array<Record<string, unknown>>>;
  initialOptions?: unknown[];
}

const DebounceProductSelect: React.FC<DebounceProductSelectProps> = ({
  value,
  onChange,
  placeholder = "🔍 Tìm thuốc, vật tư hoặc dịch vụ...",
  style,
  searchTypes = ["service", "bundle"], // Mặc định tìm tất cả
  fetcher, // Prop mới nhận hàm tìm kiếm
  initialOptions = [],
}) => {
  const [options, setOptions] = useState<DefaultOptionType[]>(
    (initialOptions as DefaultOptionType[]) || []
  );
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const latestReqIdRef = useRef(0);

  // Debounce 300ms
  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchOptions = async (keyword: string) => {
    const reqId = ++latestReqIdRef.current;
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

      // Bỏ qua response cũ (stale) nếu user đã gõ tiếp / chọn option
      if (reqId !== latestReqIdRef.current) return;

      const formattedOptions: DefaultOptionType[] = items.map((item: unknown) => {
        const prod = item as Record<string, unknown>;
        return {
          label: (
            <div
              style={{ display: "flex", alignItems: "center", padding: "4px 0" }}
            >
              {/* Icon phân loại */}
              <div style={{ marginRight: 8 }}>
                {prod.image ? (
                  <Avatar src={prod.image as string} shape="square" size="small" />
                ) : (
                  <Avatar
                    style={{
                      backgroundColor:
                        prod.type === "bundle"
                          ? "#722ed1"
                          : prod.type === "service"
                            ? "#87d068"
                            : "#1890ff",
                    }}
                    icon={
                      prod.type === "bundle" ? (
                        <GiftOutlined />
                      ) : prod.type === "service" ? (
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
                    {String(prod.name)}
                  </Text>
                  {prod.type === "service" && (
                    <Tag color="green" style={{ marginRight: 0, fontSize: 10 }}>
                      Dịch vụ
                    </Tag>
                  )}
                  {prod.type === "bundle" && (
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
                    {String(prod.sku)} | {String(prod.unit)}
                  </span>

                  {/* LOGIC HIỂN THỊ GIÁ THÔNG MINH */}
                  <Text type="secondary">
                    {(prod.last_price as number) > 0 ? (
                      // Nếu có giá nhập cũ (Trang Mua hàng) -> Hiện giá cũ
                      <span style={{ color: "#faad14" }}>
                        Giá cũ:{" "}
                        {new Intl.NumberFormat("vi-VN").format(prod.last_price as number)}
                      </span>
                    ) : (
                      // Mặc định -> Hiện giá bán/giá vốn hiện tại
                      <>
                        {prod.type === "product" ? "Giá vốn: " : "Giá bán: "}
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        }).format(
                          prod.type === "product"
                            ? (prod.price as number)
                            : (prod.retail_price as number)
                        )}
                      </>
                    )}
                  </Text>
                </div>
              </div>
            </div>
          ) as React.ReactNode,
          value: prod.id,
        } as DefaultOptionType;
      });

      setOptions(formattedOptions);
    } catch (err) {
      if (reqId !== latestReqIdRef.current) return;
      console.error(err);
    } finally {
      if (reqId !== latestReqIdRef.current) return;
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
      onChange={(val, opt) => {
        // Khi user chọn option: vô hiệu hoá các request đang chạy
        latestReqIdRef.current += 1;
        onChange?.(val, opt);
      }}
      placeholder={placeholder}
      style={style}
      suffixIcon={<SearchOutlined />}
      listHeight={256}
    />
  );
};

export default DebounceProductSelect;
