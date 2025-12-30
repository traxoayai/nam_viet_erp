import React, { useState, useRef } from 'react';
import { Select, Spin, Avatar, Tag, Typography, Empty } from 'antd';
import { UserOutlined, TeamOutlined, UsergroupAddOutlined, SearchOutlined } from '@ant-design/icons';
import { debounce } from 'lodash'; // Hoặc dùng hook useDebounce nếu có
import { posService } from '../api/posService';
import { PosCustomerSearchResult } from '../types/pos.types';

const { Text } = Typography;

interface Props {
  onSelect: (customer: PosCustomerSearchResult) => void;
}

export const PosCustomerSearch: React.FC<Props> = ({ onSelect }) => {
  const [data, setData] = useState<PosCustomerSearchResult[]>([]);
  const [fetching, setFetching] = useState(false);

  // Hàm tìm kiếm (Debounce thủ công bằng lodash hoặc setTimeout)
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
    if (type === 'ToChuc') return <TeamOutlined />;
    if (type === 'NguoiGiamHo') return <UsergroupAddOutlined />; // Icon phụ huynh
    return <UserOutlined />;
  };

  return (
    <Select
      showSearch
      placeholder="Tìm khách (F4): Tên, SĐT, Phụ huynh..."
      style={{ width: '100%' }}
      filterOption={false}
      onSearch={fetchUser}
      notFoundContent={fetching ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy" />}
      onChange={(_value, option: any) => {
        // Option.item chứa dữ liệu gốc
        if (option?.item) onSelect(option.item);
      }}
      size="large" // To cho dễ bấm
      suffixIcon={<SearchOutlined />}
    >
      {data.map((d) => (
        <Select.Option key={d.id} value={d.id} item={d}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <Avatar 
                style={{ backgroundColor: d.debt_amount > 0 ? '#ffccc7' : '#f0f0f0', color: '#333' }} 
                icon={getIcon(d.type)} 
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>{d.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{d.phone}</Text>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 {/* HIỂN THỊ SUB_LABEL (QUAN TRỌNG) */}
                 <div style={{ fontSize: 11, color: '#1890ff', fontStyle: 'italic' }}>
                    {d.sub_label || (d.type === 'ToChuc' ? 'Tổ chức' : '')}
                 </div>

                 {/* Cảnh báo nợ */}
                 {d.debt_amount > 0 && (
                   <Tag color="error" style={{ margin: 0, fontSize: 10 }}>
                     Nợ: {d.debt_amount.toLocaleString()}
                   </Tag>
                 )}
              </div>
            </div>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
};
