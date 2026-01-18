import React, { useEffect, useState } from "react";
import { Select, Avatar, Tag, Typography, Empty, Spin } from "antd";
import { ScanOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { usePosSearchStore } from "../stores/usePosSearchStore";
import { PosProductSearchResult } from "../types/pos.types";
import { supabase } from "@/shared/lib/supabaseClient";
// import { useDebounce } from "@/shared/hooks/useDebounce"; // Hook tồn tại nhưng logic dưới dùng tay (setTimeout) nên comment để tránh unused variable

const { Text } = Typography;
const { Option } = Select;

interface ProductSearchInputProps {
  warehouseId: number; // ID kho hiện tại
  onSelectProduct: (product: PosProductSearchResult) => void; // Callback khi chọn thuốc
  searchRef?: React.Ref<any>; // [NEW] Ref để focus
}

export const PosSearchInput: React.FC<ProductSearchInputProps> = ({ warehouseId, onSelectProduct, searchRef }) => {
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

  // [NEW] Logic bắt sự kiện Enter của máy quét
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          // 1. Lấy giá trị hiện tại
          const keyword = e.currentTarget.value.trim(); // Hoặc internalKeyword
          if (!keyword && !internalKeyword) return;

          const finalKeyword = keyword || internalKeyword;

          // 2. Tìm chính xác (Force search backend nếu options đang rỗng hoặc enter nhanh)
          // Lưu ý: Máy quét thường nhập Barcode rất nhanh -> Gọi API tìm Barcode
          const { data } = await supabase.rpc('search_products_pos', {
             p_keyword: finalKeyword,
             p_limit: 1, // Chỉ cần 1 kết quả chính xác
             p_warehouse_id: warehouseId
          });

          // 3. Nếu tìm thấy chính xác -> Add luôn & Xóa text để quét tiếp
          if (data && data.length > 0) {
              const product = data[0];
              // Check nếu khớp barcode hoặc SKU hoặc tên (tương đối) thì ưu tiên
              // Ở đây search_products_pos trả về list theo độ ưu tiên rồi, nên lấy cái đầu tiên là chuẩn nhất.
              if (product) {
                   onSelectProduct(product);
                   
                   // Clear input
                   setInternalKeyword(""); 
                   e.preventDefault(); // Chặn hành vi form submit / reload
              }
          }
      }
  };

  return (
    <Select
      ref={searchRef}
      onKeyDown={handleKeyDown}
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
