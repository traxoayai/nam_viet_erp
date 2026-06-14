// src/features/product/components/BarcodeAssignModal.tsx
import { BarcodeOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import {
  Modal,
  Form,
  Select,
  message,
  Typography,
  Tag,
  Avatar,
  Space,
} from "antd";
import React, { useState, useEffect } from "react";

import { safeRpc } from "@/shared/lib/safeRpc";
//import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  visible: boolean;
  scannedBarcode: string;
  onCancel: () => void;
  onSuccess: (product: unknown) => void;
}

export const BarcodeAssignModal: React.FC<Props> = ({
  visible,
  scannedBarcode,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  // State lưu danh sách sản phẩm tìm được
  const [products, setProducts] = useState<unknown[]>([]);

  // [QUAN TRỌNG] State lưu Units phải là Array Object có ID và Name, loại đơn vị
  const [units, setUnits] = useState<
    { id: number; name: string; unit_type: string; is_base: boolean }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset khi mở modal
  useEffect(() => {
    if (visible) {
      form.resetFields();
      setProducts([]);
      setUnits([]);
    }
  }, [visible]);

  // Hàm tìm kiếm sản phẩm
  const handleSearch = async (val: string) => {
    if (!val) return;
    setLoading(true);
    try {
      // Gọi RPC tìm kiếm có tách từ khóa (hỗ trợ gõ tắt/sai chính tả)
      const { data } = await safeRpc("search_products_for_barcode_assign", {
        p_keyword: val,
      });
      setProducts((data as unknown[]) || []);
    } finally {
      setLoading(false);
    }
  };

  // Khi User chọn sản phẩm -> Load danh sách Unit của SP đó vào Dropdown thứ 2
  const handleProductSelect = (productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      // Map sang mảng object có ID
      const unitOptions =
        prod.product_units?.map((u: unknown) => ({
          id: u.id,
          name: u.unit_name,
          unit_type: u.unit_type,
          is_base: u.is_base,
        })) || [];

      setUnits(unitOptions);

      // Auto select unit đầu tiên cho tiện
      if (unitOptions.length > 0) {
        form.setFieldsValue({ unit_id: unitOptions[0].id });
      } else {
        form.setFieldsValue({ unit_id: null });
      }
    }
  };

  // Xử lý Submit
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // [CORE UPDATE] Gọi RPC với tham số p_unit_id
      const { data } = await safeRpc("quick_assign_barcode", {
        p_product_id: values.product_id,
        p_unit_id: values.unit_id, // Gửi ID thay vì Name
        p_barcode: scannedBarcode,
      });
      const result = data as unknown as {
        success: boolean;
        message: string;
        data: unknown;
      } | null;
      if (result && !result.success) throw new Error(result.message);

      message.success(result?.message);

      // Trả về dữ liệu sản phẩm đầy đủ để POS/Receipt tự add vào giỏ
      onSuccess(result?.data);
    } catch (err: unknown) {
      message.error(err.message || "Lỗi gán mã vạch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <BarcodeOutlined /> Gán mã vạch mới
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="Lưu & Chọn SP này"
      zIndex={1002} // Đảm bảo nổi lên trên các thành phần khác
    >
      <div className="mb-4 text-center">
        <Typography.Text type="secondary">Mã vạch vừa quét:</Typography.Text>
        <div className="text-2xl font-bold text-blue-600 my-1">
          {scannedBarcode}
        </div>
        <Tag color="red">Chưa tồn tại trong hệ thống</Tag>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          name="product_id"
          label="Tìm và chọn sản phẩm để gán:"
          rules={[{ required: true, message: "Vui lòng chọn sản phẩm" }]}
        >
          <Select
            showSearch
            placeholder="Gõ tên hoặc mã SKU tìm kiếm..."
            filterOption={false}
            optionLabelProp="label"
            onSearch={handleSearch}
            onSelect={handleProductSelect}
            loading={loading}
            notFoundContent={
              loading ? (
                <div className="p-2 text-center text-gray-400">Đang tìm...</div>
              ) : null
            }
          >
            {products.map((p) => (
              <Select.Option key={p.id} value={p.id} label={p.name}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "8px 0",
                    alignItems: "center",
                  }}
                >
                  <Avatar
                    shape="square"
                    size={48}
                    src={p.image_url}
                    icon={<MedicineBoxOutlined />}
                    style={{
                      backgroundColor: "#f5f7fa",
                      border: "1px solid #f0f0f0",
                      flexShrink: 0,
                      borderRadius: 8,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Typography.Text
                        strong
                        style={{
                          fontSize: 14,
                          color: "#1a1a1a",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.name}
                      </Typography.Text>
                    </div>
                    <div>
                      <Space size="small">
                        <Typography.Text code style={{ fontSize: 11 }}>
                          {p.sku}
                        </Typography.Text>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                        >
                          {p.product_units
                            ?.map((u: unknown) => u.unit_name)
                            .join(", ")}
                        </Typography.Text>
                      </Space>
                    </div>
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="unit_id"
          label="Gán cho đơn vị tính nào?"
          rules={[{ required: true, message: "Vui lòng chọn đơn vị" }]}
        >
          <Select placeholder="Chọn đơn vị (Hộp/Viên/Vỉ...)">
            {/* [FIX] Dùng ID làm Key và Value -> Hết lỗi Duplicate Key */}
            {units.map((u) => {
              let tagColor = "default";
              let tagLabel = "Đơn vị";
              if (u.is_base) {
                tagColor = "blue";
                tagLabel = "Đơn vị Cơ Sở";
              } else if (u.unit_type === "retail") {
                tagColor = "green";
                tagLabel = "Đơn vị Bán Lẻ";
              } else if (u.unit_type === "wholesale") {
                tagColor = "orange";
                tagLabel = "Đơn vị Bán Sỉ";
              }

              return (
                <Select.Option key={u.id} value={u.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <span>
                      {u.name}{" "}
                      <span className="text-gray-400 text-xs ms-1">
                        #{u.id}
                      </span>
                    </span>
                    <Tag color={tagColor} style={{ margin: 0 }}>
                      {tagLabel}
                    </Tag>
                  </div>
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};
