import React, { useEffect, useState } from "react";
import { Select, Avatar, Tag, Typography, Empty, Spin } from "antd";
import { ScanOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { usePosSearchStore } from "../stores/usePosSearchStore";
import { PosProductSearchResult } from "../types/pos.types";
// import { useDebounce } from "@/shared/hooks/useDebounce"; // Hook tồn tại nhưng logic dưới dùng tay (setTimeout) nên comment để tránh unused variable

const { Text } = Typography;
const { Option } = Select;

interface ProductSearchInputProps {
  warehouseId: number; // ID kho hiện tại
  onSelectProduct: (product: PosProductSearchResult) => void; // Callback khi chọn thuốc
}

export const PosSearchInput: React.FC<ProductSearchInputProps> = ({ warehouseId, onSelectProduct }) => {
  const { keyword, setKeyword, searchProducts, results, loading } = usePosSearchStore();
  
  // Debounce việc gõ phím để tránh gọi API liên tục
  const [internalKeyword, setInternalKeyword] = useState("");
  
  // Effect: Khi người dùng gõ, chờ 500ms mới gọi Store
  useEffect(() => {
    const timer = setTimeout(() => {
        if (internalKeyword !== keyword) {
            setKeyword(internalKeyword);
            searchProducts(warehouseId);
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [internalKeyword, warehouseId]);

  return (
    <Select
      showSearch
      value={internalKeyword}
      placeholder="🔍 (F2) Quét mã vạch / Tìm tên thuốc (gõ 'effe 150')..."
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false} // Tắt filter client để dùng server search
      onSearch={setInternalKeyword}
      onSelect={(_val, option) => {
        // Option.item chứa dữ liệu gốc
        const product = (option as any).item as PosProductSearchResult;
        onSelectProduct(product);
        setInternalKeyword(""); // Reset ô tìm kiếm
      }}
      notFoundContent={loading ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy" />}
      style={{ width: "100%" }}
      size="large"
      suffixIcon={<ScanOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
      dropdownMatchSelectWidth={600} // Rộng hơn ô input để hiển thị chi tiết
    >
      {results.map((p) => (
        <Option key={p.id} value={p.id.toString()} item={p}>
          <div style={{ display: "flex", gap: 12, padding: "8px 0", alignItems: 'center' }}>
            {/* 1. Ảnh sản phẩm */}
            <Avatar 
                shape="square" 
                size={48} 
                src={p.image_url} 
                icon={<MedicineBoxOutlined />}
                style={{ backgroundColor: '#f0f0f0' }} 
            />

            <div style={{ flex: 1 }}>
              {/* 2. Tên và Giá */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Text strong style={{ fontSize: 15 }}>{p.name}</Text>
                <Text strong style={{ color: "#006d75", fontSize: 15 }}>
                  {p.retail_price.toLocaleString()} đ / {p.unit}
                </Text>
              </div>

              {/* 3. Tồn kho & Vị trí */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8c8c8c" }}>
                <span>
                   Mã: <Text code>{p.sku}</Text>
                </span>
                <span>
                   Tồn: <Text strong style={{ color: p.stock_quantity > 0 ? "#52c41a" : "#ff4d4f" }}>
                      {p.stock_quantity}
                   </Text>
                   {/* Hiển thị vị trí nếu có */}
                   {(p.location.cabinet || p.location.row) && (
                       <Tag color="orange" style={{ marginLeft: 8, marginRight: 0 }}>
                          {p.location.cabinet}-{p.location.row}-{p.location.slot}
                       </Tag>
                   )}
                </span>
              </div>
            </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};
