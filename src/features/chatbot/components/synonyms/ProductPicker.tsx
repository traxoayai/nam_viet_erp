// AutoComplete search SP cho trang quản lý synonym (Gap 1 P2.5).
// - Debounce 300ms để không gọi RPC mỗi keystroke.
// - Render label: name + sku + badge synonym_count.
// - Khi chọn → callback onChange với row đầy đủ.

import { AutoComplete, Badge, Input, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { useSynonymProductSearch } from "../../hooks/useSynonyms";

import type { ProductSearchResult } from "../../api/synonymApi";

const { Text } = Typography;

export interface ProductPickerProps {
  value: ProductSearchResult | null;
  onChange: (p: ProductSearchResult | null) => void;
}

export function ProductPicker({ value, onChange }: ProductPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(handle);
  }, [keyword]);

  const { data, isFetching } = useSynonymProductSearch(debounced);

  const options = useMemo(
    () =>
      (data ?? []).map((p) => ({
        value: String(p.id),
        label: (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>
              <Text strong>{p.name}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                {p.sku}
              </Text>
            </span>
            <Badge
              count={p.synonym_count}
              showZero
              style={{
                backgroundColor: p.synonym_count > 0 ? "#52c41a" : "#bfbfbf",
              }}
            />
          </Space>
        ),
        product: p,
      })),
    [data]
  );

  return (
    <AutoComplete
      style={{ width: "100%" }}
      value={value ? `${value.name} (${value.sku})` : keyword}
      options={options}
      onSearch={(text) => {
        setKeyword(text);
        if (value) onChange(null);
      }}
      onSelect={(_v, option) => {
        const picked = (option as unknown as { product: ProductSearchResult })
          .product;
        onChange(picked);
        setKeyword("");
      }}
      onClear={() => {
        onChange(null);
        setKeyword("");
      }}
      allowClear
      notFoundContent={isFetching ? "Đang tìm…" : "Không tìm thấy SP"}
    >
      <Input.Search placeholder="Tìm theo tên hoặc SKU…" loading={isFetching} />
    </AutoComplete>
  );
}
