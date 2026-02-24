// src/pages/partners/policies/components/PolicyProductModal.tsx
import { SearchOutlined } from "@ant-design/icons";
import { Modal, Table, Input, Tag, Space } from "antd";
import React, { useState, useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  open: boolean;
  onCancel: () => void;
  onSelect: (selectedProducts: any[]) => void;
  supplierId?: number | null;
}

export const PolicyProductModal: React.FC<Props> = ({
  open,
  onCancel,
  onSelect,
}) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      handleSearch("");
      setSelectedRowKeys([]);
      setSelectedItems([]);
    }
  }, [open]);

  const handleSearch = async (val: string) => {
    setLoading(true);
    try {
      // [FIX] Dùng RPC chuyên dụng cho B2B để lấy đúng wholesale_unit
      const { data, error } = await supabase.rpc(
        "search_products_for_b2b_order",
        {
          p_keyword: val || "",
          p_warehouse_id: 1, // Mặc định kho tổng để lấy thông tin chung
        }
      );

      if (error) throw error;

      // RPC này trả về mảng trực tiếp, không cần .data wrapper
      setProducts(data || []);
    } catch (err) {
      console.error("Search error:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "",
      dataIndex: "image_url",
      width: 50,
      render: (url: string) => (
        <img
          src={url || "https://via.placeholder.com/40"}
          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
          alt="prod"
        />
      ),
    },
    { title: "SKU", dataIndex: "sku", width: 100 },
    { title: "Tên sản phẩm", dataIndex: "name" },
    {
      title: "Đơn vị",
      dataIndex: "unit", // RPC trả về 'unit' (đơn vị bán buôn) hoặc check cột wholesale_unit
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          {/* RPC trả về wholesale_unit nếu có */}
          {r.wholesale_unit ? (
            <Tag color="blue">{r.wholesale_unit} (Sỉ)</Tag>
          ) : (
            <Tag>{r.unit || "Lẻ"}</Tag>
          )}
          {/* Hiển thị quy cách đóng gói nếu có */}
          {r.items_per_carton > 1 && (
            <span style={{ fontSize: 10, color: "#888" }}>
              1 Thùng = {r.items_per_carton} Lẻ
            </span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title="Chọn sản phẩm áp dụng"
      width={800}
      onCancel={onCancel}
      onOk={() => {
        onSelect(selectedItems);
        onCancel();
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm tên sản phẩm..."
          onChange={(e) => {
            const val = e.target.value;
            // simple debounce logic can be here or use useDebounce
            setTimeout(() => handleSearch(val), 500);
          }}
        />
      </div>

      <Table
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys);
            setSelectedItems(rows);
          },
        }}
        columns={columns}
        dataSource={products}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        loading={loading}
        size="small"
        scroll={{ y: 300 }}
      />
    </Modal>
  );
};
