// src/components/search/CustomerSearchB2B.tsx
import { UserOutlined } from "@ant-design/icons";
import { Select, Spin, Typography, Empty, Tag } from "antd";
import { useState, useEffect, useRef } from "react";

import { salesService } from "@/features/sales/api/salesService";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Text } = Typography;

interface Props {
  onSelect: (customer: unknown) => void;
  style?: React.CSSProperties;
}

export const CustomerSearchB2B = ({ onSelect, style }: Props) => {
  const [options, setOptions] = useState<Array<{ label: React.ReactNode; value: number; customer: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const latestReqIdRef = useRef(0);

  const loadData = async (keyword: string) => {
    const reqId = ++latestReqIdRef.current;
    setLoading(true);
    try {
      // Lưu ý: Nếu CORE chưa sửa lỗi 400 thì hàm này vẫn sẽ fail
      const data = await salesService.searchCustomers(keyword);
      // Bỏ qua response stale
      if (reqId !== latestReqIdRef.current) return;
      setOptions(
        data.map((c: unknown) => {
          const customer = c as Record<string, unknown>;
          return {
            label: (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <div>
                  <Text strong>{String(customer.name)}</Text>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    MST: {String(customer.tax_code)} | {String(customer.phone)}
                  </div>
                </div>
                {customer.is_bad_debt ? <Tag color="red">Nợ xấu</Tag> : null}
              </div>
            ) as React.ReactNode,
            value: customer.id as number,
            customer: customer,
          };
        })
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
    if (debouncedSearch) loadData(debouncedSearch);
  }, [debouncedSearch]);

  return (
    <Select
      showSearch
      placeholder="Tìm khách hàng B2B (Tên, MST, SĐT)..."
      filterOption={false}
      onSearch={setSearch}
      loading={loading}
      options={options}
      style={{ width: "100%", ...style }}
      onChange={(_, option: unknown) => {
        const opt = option as Record<string, unknown>;
        if (opt?.customer) {
          // Vô hiệu hoá in-flight requests khi user đã chọn xong
          latestReqIdRef.current += 1;
          onSelect(opt.customer);
        }
      }}
      notFoundContent={
        loading ? <Spin size="small" /> : <Empty description="Không tìm thấy" />
      }
      suffixIcon={<UserOutlined />}
    />
  );
};
