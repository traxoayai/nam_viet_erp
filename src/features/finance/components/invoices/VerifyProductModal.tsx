// src/features/finance/components/invoices/VerifyProductModal.tsx
import { SearchOutlined } from "@ant-design/icons";
import { Modal, Input, Table, Button, Tag, Space, Avatar } from "antd";
import React, { useState, useEffect } from "react";

import { getProducts } from "@/features/product/api/productService";
import { useDebounce } from "@/shared/hooks/useDebounce";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (product: any) => void;
}

export const VerifyProductModal: React.FC<Props> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedKeyword = useDebounce(keyword, 500);

  useEffect(() => {
    if (open) handleSearch();
  }, [debouncedKeyword, open]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await getProducts({
        filters: {
          search_query: debouncedKeyword,
          status_filter: "active", // [NEW] Only Active Products
        },
        page: 1,
        pageSize: 20,
      });
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Sản phẩm",
      key: "name",
      render: (_: any, record: any) => (
        <Space>
          <Avatar shape="square" src={record.image_url} />
          <div>
            <div style={{ fontWeight: "bold" }}>{record.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {record.sku} | {record.manufacturer_name}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Hoạt chất",
      dataIndex: "active_ingredient",
      render: (tag: string) => (tag ? <Tag color="blue">{tag}</Tag> : "-"),
    },
    {
      title: "",
      key: "action",
      render: (_: any, record: any) => (
        <Button type="primary" size="small" onClick={() => onSelect(record)}>
          Chọn
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="Tìm kiếm sản phẩm nội bộ"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="Gõ tên, hoạt chất, sku..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 16 }}
        autoFocus
      />
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
};
