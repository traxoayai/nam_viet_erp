import { Modal, Form, Select, Button } from "antd";
import React, { useEffect } from "react";

import { useWarehouseStore } from "../../stores/warehouseStore";

interface AutoReplenishModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (destinationWarehouseId: number) => void;
  loading?: boolean;
}

export const AutoReplenishModal: React.FC<AutoReplenishModalProps> = ({
  open,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const { warehouses, fetchWarehouses } = useWarehouseStore();

  useEffect(() => {
    if (open) {
      fetchWarehouses();
    }
  }, [open, fetchWarehouses]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onConfirm(values.warehouseId);
      form.resetFields();
    } catch (error) {
      // Validation error
    }
  };

  return (
    <Modal
      title="Tạo phiếu bù kho tự động (Min/Max)"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
          icon={
            <span role="img" aria-label="bolt">
              ⚡
            </span>
          } // Simple emoji icon for now
        >
          Xác nhận tạo
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="warehouseId"
          label="Chọn Kho đích (Cần bù hàng)"
          rules={[{ required: true, message: "Vui lòng chọn kho đích" }]}
          extra="Hệ thống sẽ tự động tính toán dựa trên cấu hình Min/Max của từng sản phẩm tại kho này."
        >
          <Select
            placeholder="Chọn kho..."
            loading={!warehouses.length}
            options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
