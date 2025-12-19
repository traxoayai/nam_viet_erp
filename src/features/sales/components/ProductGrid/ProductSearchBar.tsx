// src/features/sales-b2b/create/components/ProductGrid/ProductSearchBar.tsx
import {
  SearchOutlined,
  BarcodeOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { Select, Avatar, Tag, Empty, Spin, Row, Col } from "antd";
import { useState, useMemo } from "react";

import { useDebounce } from "@/shared/hooks/useDebounce";
import { salesService } from "@/features/sales/api/salesService";
import { ProductB2B } from "@/features/sales/types/b2b_sales";

interface Props {
  onSelect: (product: ProductB2B) => void;
}

export const ProductSearchBar = ({ onSelect }: Props) => {
  const [options, setOptions] = useState<
    { label: React.ReactNode; value: number; product: ProductB2B }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Logic gọi API tìm sản phẩm
  useMemo(() => {
    if (!debouncedSearch) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await salesService.searchProducts(debouncedSearch);

        // Render kết quả Rich Text theo yêu cầu Stratos
        const newOptions = data.map((item) => ({
          label: (
            <div
              style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}
            >
              <Row align="middle" gutter={12} wrap={false}>
                <Col flex="40px">
                  <Avatar
                    shape="square"
                    size={40}
                    src={item.image_url}
                    icon={<BarcodeOutlined />}
                  />
                </Col>
                <Col flex="auto">
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#0050b3",
                      lineHeight: 1.2,
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    <Tag>{item.sku}</Tag>
                    {item.shelf_location ? (
                      <Tag color="blue">
                        <EnvironmentOutlined /> {item.shelf_location}
                      </Tag>
                    ) : null}
                  </div>
                </Col>
                <Col flex="100px" style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: "bold" }}>
                    {item.price_wholesale?.toLocaleString()} ₫
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: item.stock_quantity > 0 ? "green" : "red",
                    }}
                  >
                    Tồn: {item.stock_quantity.toLocaleString()}{" "}
                    {item.wholesale_unit}
                  </div>
                </Col>
              </Row>
            </div>
          ),
          value: item.id,
          product: item,
        }));
        setOptions(newOptions);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [debouncedSearch]);

  return (
    <Select
      showSearch
      placeholder="🔍 Gõ tên, SKU hoặc quét mã vạch để thêm hàng..."
      filterOption={false}
      onSearch={setSearch}
      onSelect={(_, option: any) => {
        if (option?.product) {
          onSelect(option.product);
          setSearch(""); // Reset sau khi chọn
        }
      }}
      loading={loading}
      options={options}
      style={{ width: "100%", marginBottom: 16 }}
      size="large"
      suffixIcon={<SearchOutlined />}
      listHeight={400}
      notFoundContent={
        loading ? (
          <Spin size="small" />
        ) : (
          <Empty description="Không tìm thấy sản phẩm" />
        )
      }
      value={null}
    />
  );
};
