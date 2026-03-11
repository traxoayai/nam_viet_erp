// src/pages/inventory/transfer/components/TransferProductSearch.tsx
import { SearchOutlined } from "@ant-design/icons";
import { Select, Avatar, Tag, Space, Empty, message } from "antd";
import { debounce } from "lodash";
import React, { useState } from "react";

import { searchProductsForTransfer } from "@/features/product/api/productService";

const { Option } = Select;

interface TransferProductSearchProps {
  sourceWarehouseId: number | null;
  onSelect: (product: any) => void;
  disabled?: boolean;
}

const TransferProductSearch: React.FC<TransferProductSearchProps> = ({
  sourceWarehouseId,
  onSelect,
  disabled,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [value, setValue] = useState<string | undefined>(undefined);
  const [searchValue, setSearchValue] = useState<string>(""); // [FIX UX]: Thêm state quản lý text đang gõ

  const loadOptions = debounce(async (keyword: string) => {
    if (!keyword || !sourceWarehouseId) {
      setData([]);
      return;
    }

    setFetching(true);
    try {
      const results = await searchProductsForTransfer(
        keyword,
        sourceWarehouseId
      );
      setData(results);
    } catch (error) {
      console.error(error);
      message.error("Lỗi tìm kiếm sản phẩm");
    } finally {
      setFetching(false);
    }
  }, 500);

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  const handleSelect = (val: string, _option: any) => {
    const selected = data.find((d) => d.id === val);
    if (selected) {
      onSelect(selected);
      // [FIX UX]: Reset toàn bộ trạng thái sau khi chọn
      setValue(undefined);
      setSearchValue(""); 
      setData([]); 
    }
  };

  const onSearch = (val: string) => {
    setSearchValue(val); // [FIX UX]: Lưu lại từ khóa đang gõ
    if (!val) {
      setData([]);
      return;
    }
    if (!sourceWarehouseId) return;
    loadOptions(val);
  };

  return (
    <Select
      showSearch
      value={value}
      searchValue={searchValue} // [FIX UX]: Ép UI hiển thị text từ state này
      placeholder={
        sourceWarehouseId
          ? "Tìm tên, mã SKU sản phẩm..."
          : "Vui lòng chọn Kho Xuất trước"
      }
      style={{ width: "100%" }}
      size="large"
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false}
      onSearch={onSearch}
      onChange={handleChange}
      onSelect={handleSelect}
      onBlur={() => {
        // [FIX UX]: Khi click ra ngoài (Blur), tự động xóa text đang gõ dang dở
        setSearchValue("");
        setData([]);
      }}
      disabled={disabled || !sourceWarehouseId}
      notFoundContent={
        fetching ? null : <Empty description="Không tìm thấy sản phẩm" />
      }
      loading={fetching}
      suffixIcon={<SearchOutlined />}
      listHeight={300}
    >
      {data.map((item) => (
        <Option
          key={item.id}
          value={item.id}
          productData={item}
          disabled={item.current_stock <= 0}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "4px 0",
              gap: 12,
            }}
          >
            <Avatar
              shape="square"
              size="large"
              src={item.image_url}
              className="product-search-avatar"
            >
              {item.sku?.substring(0, 2)?.toUpperCase()}
            </Avatar>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  {item.name}
                </span>
                <Tag color={item.current_stock > 0 ? "green" : "red"}>
                  {/* [CORE UPDATE]: Sử dụng stock_display thay vì tự nối chuỗi */}
                  Tồn: {item.stock_display || item.current_stock}
                </Tag>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Space size="small">
                  <Tag style={{ margin: 0 }}>{item.sku}</Tag>
                  {item.lot_hint ? (
                    <Tag color="cyan" style={{ margin: 0, fontSize: 12 }}>
                      Gợi ý: {item.lot_hint}
                    </Tag>
                  ) : null}
                </Space>
              </div>
            </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};

export default TransferProductSearch;