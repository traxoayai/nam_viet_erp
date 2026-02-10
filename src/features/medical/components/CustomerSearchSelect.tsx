
import { useState, useEffect } from 'react';
import { Select, Tag, Spin, Empty, Button } from 'antd';
import { PlusOutlined, PhoneOutlined } from '@ant-design/icons';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { receptionService } from '@/features/medical/api/receptionService';

interface CustomerData {
  id: number;
  name: string;
  phone: string;
  code: string;
  // Add other fields as needed based on RPC result
}

interface Props {
  value?: number;
  onChange?: (val: number, customerData?: CustomerData) => void;
  onCreateNew?: (name: string) => void; 
}

export const CustomerSearchSelect = ({ value, onChange, onCreateNew }: Props) => {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  
  // Debounce search input
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (!debouncedSearch) {
        setOptions([]);
        return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await receptionService.searchCustomers(debouncedSearch);
        const newOptions = data.map((c: any) => ({
          label: c.name, 
          value: c.id,
          customer: c,
        }));
        setOptions(newOptions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [debouncedSearch]);

  const handleSearch = (val: string) => {
      setSearch(val);
  };

  const optionRender = (option: any) => {
      const { customer } = option.data;
      return (
          <div className="flex justify-between items-center py-1">
              <div>
                  <div className="font-bold text-gray-800">{customer.name}</div>
                  <div className="text-xs text-gray-500">
                      <PhoneOutlined className="mr-1"/>{customer.phone}
                      <span className="mx-1">•</span>
                      {customer.code}
                  </div>
              </div>
              {customer.loyalty_points > 0 && (
                  <Tag color="gold" className="mr-0">
                      {customer.loyalty_points} điểm
                  </Tag>
              )}
          </div>
      );
  };

  return (
    <Select
      showSearch
      value={value}
      placeholder="Tìm khách (Tên, SĐT, Mã)..."
      filterOption={false}
      onSearch={handleSearch}
      loading={loading}
      onChange={(val, opt: any) => onChange?.(val, opt?.customer)}
      style={{ width: '100%' }}
      size="large"
      options={options}
      optionRender={optionRender}
      notFoundContent={
        loading ? <Spin size="small" /> : (
            <div className="p-2 text-center">
                 <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy" />
                 {search && onCreateNew && (
                     <Button 
                        type="dashed" 
                        icon={<PlusOutlined />} 
                        onClick={() => onCreateNew(search)}
                        block
                        className="mt-2"
                     >
                        Tạo mới "{search}"
                     </Button>
                 )}
            </div>
        )
      }
    />
  );
};
