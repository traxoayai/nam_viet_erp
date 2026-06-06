// src/pages/finance/components/ClosePeriodModal.tsx
import { App, Form, Modal, Select } from "antd";
import { useState } from "react";

import type { Book } from "@/features/finance/types/accounting";

import { PERMISSIONS } from "@/features/auth/constants/permissions";
import { accountingService } from "@/features/finance/api/accountingService";
import { Access } from "@/shared/components/auth/Access";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  book: Book;
  year: number;
  month: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export const ClosePeriodModal: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setLoading(true);
    try {
      await accountingService.closePeriod(
        values.book,
        values.year,
        values.month
      );
      message.success(
        `Đã khóa kỳ ${values.month}/${values.year} - sổ ${values.book}`
      );
      form.resetFields();
      onSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Lỗi khóa kỳ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Khóa kỳ kế toán"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText="Khóa kỳ"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      destroyOnClose
    >
      <Access permission={PERMISSIONS.FINANCE.CLOSE_PERIOD}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="book"
            label="Sổ"
            rules={[{ required: true, message: "Chọn sổ" }]}
          >
            <Select placeholder="Chọn sổ">
              <Select.Option value="vat">Sổ VAT</Select.Option>
              <Select.Option value="actual">Sổ Thực</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="year"
            label="Năm"
            rules={[{ required: true, message: "Chọn năm" }]}
          >
            <Select placeholder="Chọn năm">
              {YEAR_OPTIONS.map((y) => (
                <Select.Option key={y} value={y}>
                  {y}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="month"
            label="Tháng"
            rules={[{ required: true, message: "Chọn tháng" }]}
          >
            <Select placeholder="Chọn tháng">
              {MONTH_OPTIONS.map((m) => (
                <Select.Option key={m} value={m}>
                  Tháng {m}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Access>
    </Modal>
  );
};
