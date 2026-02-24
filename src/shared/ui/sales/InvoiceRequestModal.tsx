// src/shared/ui/sales/InvoiceRequestModal.tsx
import { Modal, Form, Input, Button } from "antd";
import { useEffect } from "react";

interface InvoiceRequestModalProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (values: any) => Promise<void>;
  initialData?: any; // Dữ liệu mặc định (Lấy từ khách hàng B2B nếu có)
  loading?: boolean;
}

export const InvoiceRequestModal = ({
  visible,
  onCancel,
  onSave,
  initialData,
  loading,
}: InvoiceRequestModalProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialData) {
      form.setFieldsValue({
        companyName: initialData.name || "",
        taxCode: initialData.tax_code || "",
        address: initialData.vat_address || initialData.address || "",
        email: initialData.email || "",
        buyerName: initialData.contact_person || "",
      });
    } else {
      form.resetFields();
    }
  }, [visible, initialData, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSave(values);
      form.resetFields();
    } catch (error) {
      console.error("Validate Failed:", error);
    }
  };

  return (
    <Modal
      title="Yêu cầu Xuất Hóa Đơn VAT"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleOk}
        >
          Xác nhận Yêu cầu
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="taxCode"
          label="Mã số thuế"
          rules={[{ required: true, message: "Vui lòng nhập MST" }]}
        >
          <Input placeholder="Nhập MST..." />
        </Form.Item>

        <Form.Item
          name="companyName"
          label="Tên Đơn vị / Công ty"
          rules={[{ required: true, message: "Vui lòng nhập tên đơn vị" }]}
        >
          <Input placeholder="Công ty TNHH..." />
        </Form.Item>

        <Form.Item
          name="address"
          label="Địa chỉ xuất hóa đơn"
          rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="Số nhà, đường, phường, quận..."
          />
        </Form.Item>

        <Form.Item name="buyerName" label="Người mua hàng (Người liên hệ)">
          <Input placeholder="Tên người nhận hóa đơn" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email nhận hóa đơn"
          rules={[
            { type: "email", message: "Email không hợp lệ" },
            { required: true, message: "Cần email để gửi hóa đơn điện tử" },
          ]}
        >
          <Input placeholder="ketoan@company.com" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
