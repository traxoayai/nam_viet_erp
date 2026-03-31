// src/features/pos/components/PosSearchInput.tsx
import { ScanOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { Select, Avatar, Tag, Typography, Empty, Spin, Space } from "antd";
import React, { useEffect, useState } from "react";

import { usePosSearchStore } from "../stores/usePosSearchStore";
import { PosProductSearchResult } from "../types/pos.types";
import { safeRpc } from "@/shared/lib/safeRpc";

const { Text } = Typography;
const { Option } = Select;

interface ProductSearchInputProps {
  warehouseId: number;
  onSelectProduct: (product: PosProductSearchResult) => void;
  searchRef?: React.Ref<any>;
}

export const PosSearchInput: React.FC<ProductSearchInputProps> = ({
  warehouseId,
  onSelectProduct,
  searchRef,
}) => {
  const { keyword, setKeyword, searchProducts, results, loading } =
    usePosSearchStore();

  const [internalKeyword, setInternalKeyword] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalKeyword !== keyword) {
        setKeyword(internalKeyword);
        searchProducts(warehouseId);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [internalKeyword, warehouseId]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const keyword = e.currentTarget.value.trim();
      if (!keyword && !internalKeyword) return;

      const finalKeyword = keyword || internalKeyword;

      const { data } = await safeRpc("search_products_pos", {
        p_keyword: finalKeyword,
        p_limit: 1,
        p_warehouse_id: warehouseId,
      });

      if (data && data.length > 0) {
        const item = data[0];
        if (item) {
          const product: PosProductSearchResult = {
            id: item.id,
            name: item.name,
            sku: item.sku,
            retail_price: item.retail_price,
            image_url: item.image_url,
            unit: item.unit,
            stock_quantity: item.stock_quantity,
            location: {
              cabinet: item.location_cabinet,
              row: item.location_row,
              slot: item.location_slot,
            },
            usage_instructions: (item.usage_instructions as any) || {},
          };
          onSelectProduct(product);
          setInternalKeyword("");
          e.preventDefault();
        }
      }
    }
  };

  return (
    <div style={{ 
      position: 'relative', 
      background: '#fff', 
      borderRadius: 12,
      padding: '4px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid #e1e8ed'
    }}>
      <Select
        ref={searchRef}
        onKeyDown={handleKeyDown}
        showSearch
        value={internalKeyword}
        placeholder="🔍 Quét mã hoặc tìm tên thuốc (VD: Panadol, effe...)"
        defaultActiveFirstOption={false}
        showArrow={false}
        filterOption={false}
        onSearch={setInternalKeyword}
        onSelect={(_val, option) => {
          const product = (option as any).item as PosProductSearchResult;
          onSelectProduct(product);
          setInternalKeyword("");
        }}
        notFoundContent={
          loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}><Spin size="default" /></div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thấy thuốc" />
          )
        }
        style={{ width: "100%" }}
        size="large"
        bordered={false}
        suffixIcon={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <ScanOutlined style={{ fontSize: 22, color: "#1890ff" }} />
          </div>
        }
        dropdownMatchSelectWidth={650}
        dropdownStyle={{ borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}
      >
        {results.map((p) => (
          <Option key={p.id} value={p.id.toString()} item={p}>
            <div style={{ display: "flex", gap: 16, padding: "12px 4px", alignItems: "center" }}>
              <Avatar
                shape="circle"
                size={54}
                src={p.image_url}
                icon={<MedicineBoxOutlined />}
                style={{ backgroundColor: "#f5f7fa", border: '1px solid #f0f0f0' }}
              />

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 16, color: '#1a1a1a' }}>{p.name}</Text>
                  <Text strong style={{ color: "#fa541c", fontSize: 17 }}>
                    {p.retail_price.toLocaleString()} đ
                  </Text>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                  <Space size="small">
                    <Text code style={{ fontSize: 11 }}>{p.sku}</Text>
                    <Tag color="default" style={{ border: 'none', background: '#f0f0f0' }}>{p.unit}</Tag>
                  </Space>
                  
                  <Space size="middle">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tồn: <Text strong style={{ color: p.stock_quantity > 0 ? "#52c41a" : "#ff4d4f" }}>
                        {p.stock_quantity}
                      </Text>
                    </Text>
                    {p.location.cabinet && (
                      <Tag color="orange" style={{ margin: 0, borderRadius: 4 }}>
                        {p.location.cabinet}-{p.location.row}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
            </div>
          </Option>
        ))}
      </Select>
    </div>
  );
};

