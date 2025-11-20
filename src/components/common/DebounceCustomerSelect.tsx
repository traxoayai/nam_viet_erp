import { UserOutlined } from "@ant-design/icons";
import { Select, Spin, Avatar, Typography, Empty, Tag } from "antd";
import React, { useEffect, useState } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/lib/supabaseClient";

export interface Customer {
  id: string;
  name: string; // DB Sếp là 'name'
  phone: string; // DB Sếp là 'phone'
  type: string;
  avatar_url?: string;
  customer_code: string;
}

interface DebounceCustomerSelectProps {
  value?: any; // Để tương thích Form
  onChange?: (value: any) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const DebounceCustomerSelect: React.FC<DebounceCustomerSelectProps> = ({
  value,
  onChange,
  placeholder = "Tìm kiếm khách hàng (Tên, SĐT)...",
  style,
}) => {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchOptions = async (keyword: string) => {
    setFetching(true);
    try {
      const term = keyword.trim().toLowerCase();
      let query = supabase
        .from("customers")
        .select("id, name, phone, avatar_url, customer_code, type")
        .limit(20);

      if (term) {
        query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedOptions = (data || []).map((c: Customer) => ({
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
            }}
          >
            <Avatar src={c.avatar_url} size="small" icon={<UserOutlined />} />
            <div style={{ lineHeight: 1.2 }}>
              <Typography.Text strong>{c.name}</Typography.Text>
              <div style={{ fontSize: 11, color: "#666" }}>
                {c.customer_code} | {c.phone}
                {c.type === "ToChuc" && (
                  <Tag color="blue" style={{ marginLeft: 4, fontSize: 9 }}>
                    Tổ chức
                  </Tag>
                )}
              </div>
            </div>
          </div>
        ),
        value: c.id,
      }));
      setOptions(formattedOptions);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchOptions(debouncedSearch);
  }, [debouncedSearch]);

  return (
    <Select
      showSearch
      mode="multiple"
      filterOption={false}
      onSearch={setSearchQuery}
      onFocus={() => {
        if (options.length === 0) fetchOptions("");
      }}
      notFoundContent={
        fetching ? (
          <Spin size="small" />
        ) : (
          <Empty
            description="Không tìm thấy"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      }
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={style}
      loading={fetching}
      allowClear
    />
  );
};

export default DebounceCustomerSelect;
