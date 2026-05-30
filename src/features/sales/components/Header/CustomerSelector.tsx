// src/features/sales-b2b/create/components/Header/CustomerSelector.tsx
import { UserOutlined, LoadingOutlined } from "@ant-design/icons";
import { Select, Typography, Empty, Avatar, Tag } from "antd";
import { useState, useRef, useEffect } from "react";

import { salesService } from "@/features/sales/api/salesService";
import { CustomerB2B } from "@/features/sales/types/b2b_sales";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Text } = Typography;

interface Props {
  onSelect: (customer: CustomerB2B) => void;
}

export const CustomerSelector = ({ onSelect }: Props) => {
  const [options, setOptions] = useState<
    {
      label: React.ReactNode;
      value: number;
      customer: CustomerB2B;
      displayNode?: React.ReactNode;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Request-id counter để chống race: khi user gõ/chọn nhanh,
  // chỉ response của request mới nhất mới được phép setOptions.
  const latestReqIdRef = useRef(0);

  // Logic gọi API khi debounce
  useEffect(() => {
    if (!debouncedSearch) return;

    const reqId = ++latestReqIdRef.current;

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await salesService.searchCustomers(debouncedSearch);
        // Bỏ qua nếu đã có request mới hơn (race-safe).
        if (reqId !== latestReqIdRef.current) return;
        const newOptions = data.map((c) => ({
          label: `${c.name} - SĐT: ${c.phone}${c.tax_code ? ` - MST: ${c.tax_code}` : ""}`,
          value: c.id,
          customer: c,
          displayNode: (
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
        }));
        setOptions(newOptions);
      } catch (e) {
        if (reqId !== latestReqIdRef.current) return;
        console.error(e);
      } finally {
        if (reqId === latestReqIdRef.current) {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [debouncedSearch]);

  // Wrap onSelect: bump reqId để invalidate mọi response đang in-flight,
  // tránh option list nhảy lung tung sau khi đã chọn customer.
  const handleChange = (
    _: unknown,
    option?: { customer?: CustomerB2B } | { customer?: CustomerB2B }[]
  ) => {
    const picked = Array.isArray(option) ? option[0] : option;
    if (picked?.customer) {
      latestReqIdRef.current += 1;
      onSelect(picked.customer);
    }
  };

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
      optionRender={(option) => option.data.displayNode}
      onChange={handleChange}
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
