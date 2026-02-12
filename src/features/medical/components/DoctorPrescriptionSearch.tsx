
// src/features/medical/components/DoctorPrescriptionSearch.tsx
import React, { useEffect, useState } from "react";
import { Select, Avatar, Tag, Typography, Empty, Spin } from "antd";
import { ScanOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { supabase } from "@/shared/lib/supabaseClient";
import { PosProductSearchResult } from "@/features/pos/types/pos.types";

const { Text } = Typography;
const { Option } = Select;

interface Props {
  warehouseId?: number; // Optional, nếu không truyền sẽ tìm all hoặc default
  onSelectProduct: (product: PosProductSearchResult) => void;
}

export const DoctorPrescriptionSearch: React.FC<Props> = ({ warehouseId = 1, onSelectProduct }) => {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<PosProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalKeyword, setInternalKeyword] = useState("");

  // Debounce search logic
  useEffect(() => {
    const timer = setTimeout(() => {
        if (internalKeyword && internalKeyword !== keyword) {
            setKeyword(internalKeyword);
            handleSearch(internalKeyword);
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [internalKeyword]);

  const handleSearch = async (term: string) => {
      setLoading(true);
      try {
          const { data, error } = await supabase.rpc('search_products_pos', {
             p_keyword: term,
             p_limit: 20, 
             p_warehouse_id: warehouseId
          });
          if (error) throw error;
          setResults(data || []);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          const term = e.currentTarget.value.trim();
          if (!term) return;

          // Force search 1 item if enter pressed
          const { data } = await supabase.rpc('search_products_pos', {
             p_keyword: term,
             p_limit: 1, 
             p_warehouse_id: warehouseId
          });

          if (data && data.length > 0) {
               onSelectProduct(data[0]);
               setInternalKeyword(""); 
               e.preventDefault(); 
          }
      }
  };

  return (
    <Select
      showSearch
      value={internalKeyword}
      placeholder="Gõ tên thuốc, hoạt chất hoặc mã..."
      defaultActiveFirstOption={false}
      suffixIcon={<ScanOutlined />}
      filterOption={false}
      searchValue={internalKeyword} // Controlled search input
      onSearch={setInternalKeyword}
      onSelect={(_val, option) => {
        const product = (option as any).item as PosProductSearchResult;
        onSelectProduct(product);
        setInternalKeyword("");
      }}
      notFoundContent={loading ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy" />}
      style={{ width: "100%" }}
      size="middle"
      dropdownMatchSelectWidth={500}
      onInputKeyDown={handleKeyDown}
    >
      {results.map((p) => (
        <Option key={p.id} value={p.id.toString()} item={p}>
          <div style={{ display: "flex", gap: 12, padding: "4px 0", alignItems: 'center' }}>
            <Avatar shape="square" size={32} src={p.image_url || undefined} icon={<MedicineBoxOutlined />} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text strong>{p.name}</Text>
                <Tag color="blue">{p.unit}</Tag>
              </div>
              <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                 <Text code>{p.sku}</Text> • Tồn: <span className={p.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}>{p.stock_quantity}</span>
              </div>
            </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};
