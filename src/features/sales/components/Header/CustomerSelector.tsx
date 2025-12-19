// src/features/sales-b2b/create/components/Header/CustomerSelector.tsx
import { UserOutlined, LoadingOutlined } from "@ant-design/icons";
import { Select, Typography, Empty, Avatar, Tag } from "antd";
import { useState, useMemo } from "react";

import { useDebounce } from "@/shared/hooks/useDebounce";
import { salesService } from "@/features/sales/api/salesService";
import { CustomerB2B } from "@/features/sales/types/b2b_sales";

const { Text } = Typography;

interface Props {
  onSelect: (customer: CustomerB2B) => void;
}

export const CustomerSelector = ({ onSelect }: Props) => {
  const [options, setOptions] = useState<
    { label: React.ReactNode; value: number; customer: CustomerB2B }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Logic gọi API khi debounce
  useMemo(() => {
    if (!debouncedSearch) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await salesService.searchCustomers(debouncedSearch);
        const newOptions = data.map((c) => ({
          label: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar
                  style={{
                    backgroundColor: c.is_bad_debt ? "#ff4d4f" : "#87d068",
                  }}
                  icon={<UserOutlined />}
                  size="small"
                />
                <div>
                  <Text strong>{c.name}</Text>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    MST: {c.tax_code || "---"} | {c.phone}
                  </div>
                </div>
              </div>
              {c.is_bad_debt ? <Tag color="red">Nợ xấu</Tag> : null}
            </div>
          ),
          value: c.id,
          customer: c,
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
      placeholder="🔍 Tìm khách hàng (Tên, MST, SĐT)..."
      filterOption={false}
      onSearch={setSearch}
      loading={loading}
      options={options}
      style={{ width: "100%" }}
      size="large"
      suffixIcon={loading ? <LoadingOutlined /> : <UserOutlined />}
      onChange={(_, option: any) => {
        if (option?.customer) onSelect(option.customer);
      }}
      notFoundContent={
        loading ? null : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy"
          />
        )
      }
    />
  );
};
