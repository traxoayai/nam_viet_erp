// src/components/search/ProductSearchB2B.tsx
import { BarcodeOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { Select, Avatar, Tag, Typography, Spin, Empty, Tooltip } from "antd";
import { useState, useEffect, useRef } from "react";

import { salesService } from "@/features/sales/api/salesService";
import { ProductB2B } from "@/features/sales/types/b2b_sales";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Text } = Typography;

// [NEW] Định nghĩa Props để nhận hàm xử lý từ cha
interface ProductSearchB2BProps {
  onSelect: (product: ProductB2B) => void;
  warehouseId?: number;
}

export const ProductSearchB2B = ({
  onSelect,
  warehouseId = 1,
}: ProductSearchB2BProps) => {
  const [options, setOptions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const latestReqIdRef = useRef(0);

  const handleSearch = async (keyword: string) => {
    if (!keyword) return;
    const reqId = ++latestReqIdRef.current;
    setLoading(true);
    try {
      // [FIX] Truyền warehouseId vào service
      const results = await salesService.searchProducts(keyword, warehouseId);

      // Bỏ qua response stale (user đã gõ tiếp hoặc chọn xong)
      if (reqId !== latestReqIdRef.current) return;

      // Auto add nếu khớp barcode 100%
      if (results.length === 1 && keyword.length > 8 && !loading) {
        latestReqIdRef.current += 1; // invalidate sau khi auto-select
        onSelect(results[0]); // Gọi prop từ cha
        setSearch("");
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
      if (reqId !== latestReqIdRef.current) return;
      console.error(e);
    } finally {
      if (reqId !== latestReqIdRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch(debouncedSearch);
  }, [debouncedSearch]);

  const renderOption = (p: ProductB2B) => (
    <div style={{ display: "flex", alignItems: "center", padding: 4 }}>
      <Avatar
        shape="square"
        size={40}
        src={p.image_url || undefined}
        icon={<BarcodeOutlined />}
      />
      <div style={{ marginLeft: 10, flex: 1 }}>
        <Text strong>{p.name}</Text>
        <div style={{ fontSize: 11, color: "#666" }}>
          <Tag color="blue">{p.sku}</Tag>
          {/* Hiển thị đơn vị bán buôn */}
          <Tag color="orange">{p.wholesale_unit || "Bán Lẻ"}</Tag>
          <EnvironmentOutlined /> {p.shelf_location}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        {/* [FIX] Hiển thị giá bán buôn (price_wholesale) */}
        <Text strong style={{ color: "#cf1322", fontSize: 13 }}>
          {p.price_wholesale ? p.price_wholesale.toLocaleString() : 0} đ
        </Text>
        {/* [V20 LOGIC] Color Stock Display */}
        {(() => {
          const available = p.available_stock ?? p.stock_quantity ?? 0;
          const real = p.real_stock ?? p.stock_quantity ?? 0;

          let color = "red"; // Default: Hết hàng (Real <= 0)
          let statusText = "Hết hàng";

          if (available > 0) {
            color = "green";
            statusText = `Sẵn sàng: ${available}`;
          } else if (real > 0) {
            color = "gold"; // Có hàng nhưng đã committed
            statusText = "Đang giữ hàng";
          }

          return (
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <Tooltip title={`Thực tế: ${real} / Khả dụng: ${available}`}>
                <Tag color={color} style={{ marginRight: 0 }}>
                  {available > 0 ? `Tồn: ${available}` : statusText}
                </Tag>
              </Tooltip>
            </div>
          );
        })()}
      </div>
    </div>
  );

  return (
    <Select
      showSearch
      value={null}
      placeholder="🔍 Tìm tên, mã SP hoặc quét Barcode..."
      defaultActiveFirstOption={true}
      filterOption={false}
      onSearch={setSearch}
      onSelect={(_, opt: unknown) => {
        // Vô hiệu hoá in-flight requests sau khi user chọn
        latestReqIdRef.current += 1;
        const option = opt as Record<string, unknown>;
        onSelect(option.product as ProductB2B); // Gọi prop từ cha
        setSearch("");
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
