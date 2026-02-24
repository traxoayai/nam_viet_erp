// src/pages/partners/policies/components/ExcelPreviewModal.tsx
import {
  DeleteOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Modal, Table, Button, Space, Tag, message } from "antd";
import React, { useState, useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient";
import { DebounceSelect } from "@/shared/ui/common/DebounceSelect";

interface ExcelItem {
  key: string;
  excel_name: string;
  excel_sku: string;

  // System match
  system_product_id?: number;
  system_product_name?: string;
  system_product_sku?: string;

  match_score?: number;
}

interface Props {
  open: boolean;
  data: any[]; // Raw data from RPC
  onCancel: () => void;
  onConfirm: (products: any[]) => void;
}

export const ExcelPreviewModal: React.FC<Props> = ({
  open,
  data,
  onCancel,
  onConfirm,
}) => {
  const [items, setItems] = useState<ExcelItem[]>([]);

  useEffect(() => {
    if (open && data) {
      // Map RPC result to keys
      // Console log for debugging
      console.log("Excel RPC Data:", data);

      const mapped = data.map((d, index) => ({
        key: `${index}-${d.product_id || "new"}`,
        excel_name:
          d.excel_name || d.raw_name || d.input_name || d.name || "N/A", // Fallback keys
        excel_sku: d.excel_sku || d.raw_sku || d.input_sku || d.sku || "",

        system_product_id: d.similarity_score >= 0.8 ? d.product_id : undefined,
        system_product_name:
          d.similarity_score >= 0.8 ? d.product_name : undefined,
        system_product_sku:
          d.similarity_score >= 0.8 ? d.product_sku : undefined,

        match_score: d.similarity_score,
      }));
      setItems(mapped);
    }
  }, [open, data]);

  const handleDelete = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const handleConfirm = () => {
    const validItems = items
      .filter((i) => i.system_product_id)
      .map((i) => ({
        id: i.system_product_id,
        name: i.system_product_name,
        sku: i.system_product_sku,
      }));

    if (validItems.length === 0) {
      message.warning("Chưa có sản phẩm nào được chọn!");
      return;
    }

    onConfirm(validItems);
    onCancel();
  };

  // 1. Hàm fetch dữ liệu đúng chuẩn RPC B2B
  const fetchProductOptions = async (search: string) => {
    const { data, error } = await supabase.rpc(
      "search_products_for_b2b_order",
      {
        p_keyword: search || "",
        p_warehouse_id: 1,
      }
    );

    if (error) return [];

    // Map sang format mà Ant Design Select cần
    return (data || []).map((p: any) => ({
      label: (
        // CUSTOM UI HIỂN THỊ OPTION
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, padding: 4 }}
        >
          <img
            src={p.image_url || "https://via.placeholder.com/40"}
            alt="img"
            style={{
              width: 32,
              height: 32,
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid #eee",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span style={{ fontSize: 11, color: "#666" }}>
              {p.sku} | ĐV Sỉ:{" "}
              <span style={{ color: "#1890ff" }}>
                {p.wholesale_unit || "N/A"}
              </span>
            </span>
          </div>
        </div>
      ),
      value: p.id,
      // Dữ liệu thô để dùng khi select
      product: p,
    }));
  };

  const handleProductChange = (key: string, selectedOption: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          // Nếu selectedOption null (xóa) -> reset
          if (!selectedOption) {
            return {
              ...item,
              system_product_id: undefined,
              system_product_name: undefined,
              system_product_sku: undefined,
            };
          }

          // Lấy dữ liệu từ option đã chọn (Check cả selectedOption và selectedOption.product an toàn)
          // Khi dùng DebounceSelect, selectedOption chính là object trong mảng options
          const rawProduct = selectedOption.product || selectedOption;

          return {
            ...item,
            system_product_id: rawProduct.id,
            system_product_name: rawProduct.name, // Lưu tên để hiển thị lại
            system_product_sku: rawProduct.sku,
          };
        }
        return item;
      })
    );
  };

  const columns = [
    {
      title: "Dữ liệu Excel",
      key: "excel",
      width: 250,
      render: (_: any, r: ExcelItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.excel_name}</div>
          {r.excel_sku ? <Tag>{r.excel_sku}</Tag> : null}
        </div>
      ),
    },
    {
      title: "Khớp với Sản phẩm Hệ thống",
      key: "system",
      render: (_: any, r: ExcelItem) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <DebounceSelect
            showSearch
            fetchOptions={fetchProductOptions}
            placeholder="Gõ tên/SKU để tìm..."
            style={{ width: "100%" }}
            // [FIX] Value phải là object { value, label } để hiện đúng tên sau khi chọn
            value={
              r.system_product_id
                ? {
                    value: r.system_product_id,
                    label: r.system_product_name, // Quan trọng: Phải có label thì Select mới hiện chữ
                  }
                : undefined
            }
            onChange={(_val: any, opt: any) => handleProductChange(r.key, opt)}
          />
          {r.match_score !== undefined && r.match_score >= 0.8 && (
            <div style={{ fontSize: 11, color: "#52c41a" }}>
              <CheckCircleOutlined /> Tự động khớp cao
            </div>
          )}
          {!r.system_product_id && (r.match_score || 0) < 0.8 && (
            <div style={{ fontSize: 11, color: "#faad14" }}>
              <WarningOutlined /> Chưa khớp
            </div>
          )}
        </div>
      ),
    },
    {
      title: "",
      key: "action",
      width: 50,
      render: (_: any, r: ExcelItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(r.key)}
        />
      ),
    },
  ];

  const stats = {
    total: items.length,
    matched: items.filter((i) => i.system_product_id).length,
    unmatched: items.filter((i) => !i.system_product_id).length,
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="Duyệt kết quả nhập Excel"
      width={800}
      footer={[
        <div
          key="footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space>
            <Tag>Tổng: {stats.total}</Tag>
            <Tag color="success">Hợp lệ: {stats.matched}</Tag>
            <Tag color="warning">Chưa khớp: {stats.unmatched}</Tag>
          </Space>
          <Space>
            <Button onClick={onCancel}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleConfirm}
              disabled={stats.matched === 0}
            >
              Đưa vào danh sách ({stats.matched})
            </Button>
          </Space>
        </div>,
      ]}
    >
      <Table
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </Modal>
  );
};
