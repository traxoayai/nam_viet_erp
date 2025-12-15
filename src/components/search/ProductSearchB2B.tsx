// src/components/search/ProductSearchB2B.tsx
import { BarcodeOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { Select, Avatar, Tag, Typography, Spin, Empty } from "antd";
import { useState, useEffect } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import { salesService } from "@/services/salesService";
import { useSalesStore } from "@/stores/useSalesStore";

const { Text } = Typography;

export const ProductSearchB2B = () => {
  const { addItem } = useSalesStore();
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Logic debounce cho tìm kiếm tay
  const debouncedSearch = useDebounce(search, 300);

  // Load data
  const handleSearch = async (keyword: string) => {
    if (!keyword) return;
    setLoading(true);
    try {
      const results = await salesService.searchProducts(keyword);

      // LOGIC BARCODE SCANNER:
      // Nếu kết quả trả về đúng 1 SP và keyword khớp barcode -> Auto add
      // (Giả định barcode thường dài > 8 ký tự)
      if (results.length === 1 && keyword.length > 8 && !loading) {
        addItem(results[0]);
        setSearch(""); // Clear ngay sau khi add
        setOptions([]);
        return;
      }

      setOptions(
        results.map((p) => ({
          label: renderOption(p),
          value: p.id,
          product: p,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Effect khi debounce thay đổi (dành cho gõ phím)
  useEffect(() => {
    handleSearch(debouncedSearch);
  }, [debouncedSearch]);

  const renderOption = (p: any) => (
    <div style={{ display: "flex", alignItems: "center", padding: 4 }}>
      <Avatar
        shape="square"
        size={40}
        src={p.image_url}
        icon={<BarcodeOutlined />}
      />
      <div style={{ marginLeft: 10, flex: 1 }}>
        <Text strong>{p.name}</Text>
        <div style={{ fontSize: 11, color: "#666" }}>
          <Tag color="blue">{p.sku}</Tag>
          <EnvironmentOutlined /> {p.shelf_location} | Lô:{" "}
          {p.lot_number || "N/A"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <Text strong style={{ color: "#1677ff" }}>
          {p.price_wholesale.toLocaleString()} đ
        </Text>
        <div style={{ fontSize: 11 }}>
          Tồn: {p.stock_quantity} {p.wholesale_unit}
        </div>
      </div>
    </div>
  );

  return (
    <Select
      showSearch
      value={null} // Luôn reset sau khi chọn
      placeholder="🔍 Gõ tên hoặc Quét mã vạch (Tự động thêm vào giỏ)..."
      defaultActiveFirstOption={true}
      filterOption={false}
      onSearch={setSearch}
      onSelect={(_, opt: any) => {
        addItem(opt.product);
        setSearch(""); // Reset ô tìm kiếm
      }}
      loading={loading}
      options={options}
      style={{ width: "100%" }}
      size="large"
      notFoundContent={
        loading ? <Spin size="small" /> : <Empty description="Không tìm thấy" />
      }
    />
  );
};
