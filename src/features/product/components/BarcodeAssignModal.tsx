// src/features/product/components/BarcodeAssignModal.tsx
import { BarcodeOutlined } from "@ant-design/icons";
import { Modal, Form, Select, message, Typography, Tag } from "antd";
import React, { useState, useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  visible: boolean;
  scannedBarcode: string;
  onCancel: () => void;
  onSuccess: (product: any) => void;
}

export const BarcodeAssignModal: React.FC<Props> = ({
  visible,
  scannedBarcode,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  // State lưu danh sách sản phẩm tìm được
  const [products, setProducts] = useState<any[]>([]);

  // [QUAN TRỌNG] State lưu Units phải là Array Object có ID và Name
  const [units, setUnits] = useState<{ id: number; name: string }[]>([]);

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
      // Select thêm ID của units
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, image_url, product_units(id, unit_name)")
        .ilike("name", `%${val}%`)
        .limit(10);
      setProducts(data || []);
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
        prod.product_units?.map((u: any) => ({
          id: u.id,
          name: u.unit_name,
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
      const { data, error } = await supabase.rpc("quick_assign_barcode", {
        p_product_id: values.product_id,
        p_unit_id: values.unit_id, // Gửi ID thay vì Name
        p_barcode: scannedBarcode,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      message.success(data.message);

      // Trả về dữ liệu sản phẩm đầy đủ để POS/Receipt tự add vào giỏ
      onSuccess(data.data);
    } catch (err: any) {
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
            placeholder="Gõ tên tìm kiếm..."
            filterOption={false}
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
              <Select.Option key={p.id} value={p.id}>
                {p.name}{" "}
                <span className="text-gray-400 text-xs">({p.sku})</span>
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
            {units.map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.name}{" "}
                <span className="text-gray-400 text-xs ms-1">#{u.id}</span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};
