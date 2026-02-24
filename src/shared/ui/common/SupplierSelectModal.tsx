// src/components/common/SupplierSelectModal.tsx
import { Modal, Button, Input, Table, Spin } from "antd";
import React, { useState, useEffect } from "react";

import { useSupplierStore } from "@/features/purchasing/stores/supplierStore"; // Dùng "bộ não" NCC
import { Supplier } from "@/features/purchasing/types/supplier";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Search } = Input;

interface SupplierSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (supplier: Supplier) => void;
}

const SupplierSelectModal: React.FC<SupplierSelectModalProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const {
    suppliers,
    loading,
    page,
    pageSize,
    totalCount,
    setFilters,
    setPage,
  } = useSupplierStore();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (open) {
      // Khi modal mở, tải dữ liệu
      setFilters({ search_query: debouncedSearch });
    }
  }, [open, debouncedSearch, page, pageSize, setFilters]);

  const handleSelect = (supplier: Supplier) => {
    onSelect(supplier);
    onClose();
  };

  const columns = [
    { title: "Mã NCC", dataIndex: "code", key: "code" },
    { title: "Tên Nhà Cung Cấp", dataIndex: "name", key: "name" },
    { title: "SĐT", dataIndex: "phone", key: "phone" },
    {
      title: "Hành động",
      key: "action",
      render: (_: any, record: Supplier) => (
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
      title="Tìm kiếm & Chọn Nhà Cung Cấp"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Search
        placeholder="Tìm theo Tên, Mã, SĐT..."
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ marginBottom: 16 }}
        loading={loading}
      />
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={suppliers}
          rowKey="key"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: totalCount,
            onChange: setPage,
          }}
        />
      </Spin>
    </Modal>
  );
};

export default SupplierSelectModal;
