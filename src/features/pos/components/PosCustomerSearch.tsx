import {
  UserOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Select, Spin, Avatar, Tag, Typography, Button } from "antd";
import { debounce } from "lodash";
import React, { useState, useRef } from "react";

import { posService } from "../api/posService";
import { PosCustomerSearchResult } from "../types/pos.types";

const { Text } = Typography;

interface Props {
  onSelect: (customer: PosCustomerSearchResult) => void;
  onAddNew?: () => void;
}

export const PosCustomerSearch: React.FC<Props> = ({ onSelect, onAddNew }) => {
  const [data, setData] = useState<PosCustomerSearchResult[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchUser = useRef(
    debounce(async (value: string) => {
      if (!value) {
        setData([]);
        return;
      }
      setFetching(true);
      try {
        const result = await posService.searchCustomers(value);
        setData(result);
      } finally {
        setFetching(false);
      }
    }, 500)
  ).current;

  const getIcon = (type: string) => {
    if (type === "ToChuc") return <TeamOutlined style={{ fontSize: 18 }} />;
    if (type === "NguoiGiamHo") return <UsergroupAddOutlined style={{ fontSize: 18 }} />;
    return <UserOutlined style={{ fontSize: 18 }} />;
  };

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 12, 
      padding: '4px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      border: '1px solid #e1e8ed',
      marginBottom: 12
    }}>
      <Select
        showSearch
        placeholder="👤 Tìm khách (F4): Tên, SĐT, Phụ huynh..."
        style={{ width: "100%" }}
        filterOption={false}
        onSearch={fetchUser}
        notFoundContent={
          fetching ? (
            <div style={{ padding: 16, textAlign: 'center' }}><Spin size="default" /></div>
          ) : (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                Không tìm thấy khách hàng này?
              </Typography.Text>
              {onAddNew && (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 8 }}
                  onClick={onAddNew}
                >
                  Thêm Khách Mới
                </Button>
              )}
            </div>
          )
        }
        onChange={(_value, option: any) => {
          if (option?.item) onSelect(option.item);
        }}
        size="large"
        suffixIcon={<SearchOutlined style={{ fontSize: 20, color: "#1890ff" }} />}
        bordered={false}
        dropdownStyle={{ borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
      >
        {data.map((d) => (
          <Select.Option key={d.id} value={d.id} item={d}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 4px",
              }}
            >
              <Avatar
                size={44}
                style={{
                  backgroundColor: d.debt_amount > 0 ? "#fff2f0" : "#f0f5ff",
                  color: d.debt_amount > 0 ? "#ff4d4f" : "#1890ff",
                  border: `1px solid ${d.debt_amount > 0 ? "#ffccc7" : "#d6e4ff"}`
                }}
                icon={getIcon(d.type)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 15 }}>{d.name}</Text>
                  <Text style={{ fontSize: 13, color: '#595959' }}>
                    {d.phone}
                  </Text>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                    {d.sub_label || (d.type === "ToChuc" ? "🏢 Doanh nghiệp" : "👤 Cá nhân")}
                  </div>

                  {d.debt_amount > 0 && (
                    <Tag color="error" style={{ margin: 0, borderRadius: 4, fontWeight: 600 }}>
                      Nợ: {d.debt_amount.toLocaleString()}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

