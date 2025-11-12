// src/components/common/GuardianSelectModal.tsx
import { Modal, Button, Input, Table, Spin, App as AntApp, Empty } from "antd";
import React, { useState, useEffect } from "react";

import type { TableProps } from "antd";

import { useDebounce } from "@/hooks/useDebounce";
import { useCustomerB2CStore } from "@/stores/useCustomerB2CStore";
import { CustomerListRecord } from "@/types/customer";

const { Search } = Input;

interface GuardianSelectModalProps {
  open: boolean;
  onClose: () => void; // Hàm callback trả về khách hàng (Bố/Mẹ) đã được chọn
  onSelect: (customer: CustomerListRecord) => void;
}

const GuardianSelectModal: React.FC<GuardianSelectModalProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { searchGuardians } = useCustomerB2CStore();
  const { message: antMessage } = AntApp.useApp();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CustomerListRecord[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 400); // Tự động tìm kiếm khi người dùng gõ

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 3) {
      handleSearch(debouncedSearch);
    } else {
      setResults([]); // Xóa kết quả nếu query quá ngắn
    }
  }, [debouncedSearch]);

  const handleSearch = async (query: string) => {
    setLoading(true);
    try {
      const data = await searchGuardians(query);
      setResults(data);
    } catch (error: any) {
      antMessage.error(`Lỗi tìm kiếm: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (customer: CustomerListRecord) => {
    onSelect(customer);
    onClose();
  };

  const columns: TableProps<CustomerListRecord>["columns"] = [
    { title: "Mã KH", dataIndex: "customer_code", key: "customer_code" },
    { title: "Tên Khách hàng", dataIndex: "name", key: "name" },
    { title: "SĐT", dataIndex: "phone", key: "phone" },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      render: (_, record: CustomerListRecord) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleSelect(record)}
        >
          Chọn
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="Tìm & Thêm Người Giám hộ (Bố/Mẹ)"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
           
      <Search
        placeholder="Tìm theo Tên hoặc SĐT (ít nhất 3 ký tự)..."
        onChange={(e) => setSearchQuery(e.target.value)}
        onSearch={handleSearch}
        style={{ marginBottom: 16 }}
        loading={loading}
        enterButton
      />
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={results}
          rowKey="key"
          pagination={false}
          locale={{
            emptyText: <Empty description="Không tìm thấy khách hàng nào." />,
          }}
        />
      </Spin>
    </Modal>
  );
};

export default GuardianSelectModal;
