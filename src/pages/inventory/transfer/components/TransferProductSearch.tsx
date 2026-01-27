//src/pages/inventory/transfer/components/TransferProductSearch.tsx
import React, { useState } from 'react';
import { Select, Avatar, Tag, Space, Empty, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { searchProductsForTransfer } from '@/features/product/api/productService';
import { debounce } from 'lodash';

// Style constants from B2B requirement
const { Option } = Select;

interface TransferProductSearchProps {
  sourceWarehouseId: number | null;
  onSelect: (product: any) => void;
  disabled?: boolean;
}

const TransferProductSearch: React.FC<TransferProductSearchProps> = ({ 
  sourceWarehouseId, 
  onSelect,
  disabled 
}) => {
  const [data, setData] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [value, setValue] = useState<string>();

  // Use debounce for search API call
  const loadOptions = debounce(async (keyword: string) => {
    if (!keyword || !sourceWarehouseId) {
       setData([]);
       return;
    }
    
    setFetching(true);
    try {
      const results = await searchProductsForTransfer(keyword, sourceWarehouseId);
      setData(results);
    } catch (error) {
      console.error(error);
      message.error("Lỗi tìm kiếm sản phẩm");
    } finally {
      setFetching(false);
    }
  }, 500);

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };
  
  const handleSelect = (val: string, _option: any) => {
     // Find the full product object from data
     // Use option.productData if we attached it, or find in data
     const selected = data.find(d => d.id === val);
     if (selected) {
         onSelect(selected);
         setValue(undefined); // Clear search after select
     }
  };

  const onSearch = (val: string) => {
      if (!val) return;
      if (!sourceWarehouseId) {
          // Warning displayed by UI state (placeholder) but good to block
          return;
      }
      loadOptions(val);
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder={sourceWarehouseId ? "Tìm tên, mã SKU sản phẩm..." : "Vui lòng chọn Kho Xuất trước"}
      style={{ width: '100%' }}
      size="large"
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false}
      onSearch={onSearch}
      onChange={handleChange}
      onSelect={handleSelect}
      disabled={disabled || !sourceWarehouseId}
      notFoundContent={fetching ? null : <Empty description="Không tìm thấy sản phẩm" />}
      loading={fetching}
      suffixIcon={<SearchOutlined />}
      listHeight={300}
    >
      {data.map((item) => (
        <Option key={item.id} value={item.id} productData={item} disabled={item.current_stock <= 0}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', gap: 12 }}>
             {/* 1. Avatar */}
             <Avatar 
                shape="square" 
                size="large" 
                src={item.image_url} 
                className="product-search-avatar"
             >
                {item.sku?.substring(0, 2)?.toUpperCase()}
             </Avatar>

             {/* 2. Info Content */}
             <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                    <Tag color={item.current_stock > 0 ? 'green' : 'red'}>
                        Tồn: {Number(item.current_stock || 0).toLocaleString()}
                    </Tag>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size="small">
                        <Tag style={{ margin: 0 }}>{item.sku}</Tag>
                        {item.lot_hint && (
                            <Tag color="cyan" style={{ margin: 0, fontSize: 12 }}>
                                Gợi ý: {item.lot_hint}
                            </Tag>
                        )}
                    </Space>
                    
                    <span style={{ color: '#888', fontSize: 12 }}>
                         Đơn vị: {item.unit}
                    </span>
                </div>
             </div>
          </div>
        </Option>
      ))}
    </Select>
  );
};

export default TransferProductSearch;
