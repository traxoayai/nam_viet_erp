// Period Close Page — Minimal stub version
// - Allow chốt kỳ kế toán

import {
  App,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useState } from "react";

import { accountingService } from "../api/accountingService";

import type { Book } from "../types/accounting";

const { Title, Text } = Typography;

const PeriodClosePage: React.FC = () => {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleClose = async (values: {
    book: Book;
    year: number;
    month: number;
  }) => {
    modal.confirm({
      title: "Xác nhận chốt kỳ",
      content: `Chốt kỳ ${values.month}/${values.year} cho sổ ${values.book === "TAX" ? "Thuế" : "Nội bộ"}? Hành động này không thể hoàn tác.`,
      okText: "Chốt",
      cancelText: "Hủy",
      onOk: async () => {
        setLoading(true);
        try {
          await accountingService.closePeriod(
            values.book,
            values.year,
            values.month
          );
          message.success("Chốt kỳ thành công");
          form.resetFields();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Lỗi chốt kỳ");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Card title="Chốt Kỳ Kế Toán">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={16}>
          <Form form={form} layout="vertical" onFinish={handleClose}>
            <Form.Item
              label="Sổ Kế Toán"
              name="book"
              rules={[{ required: true, message: "Chọn sổ" }]}
            >
              <Select
                placeholder="Chọn sổ"
                options={[
                  { label: "Sổ Nội bộ", value: "INTERNAL" },
                  { label: "Sổ Thuế", value: "TAX" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Năm"
              name="year"
              rules={[{ required: true, message: "Nhập năm" }]}
            >
              <InputNumber
                placeholder="2024"
                min={2000}
                max={2100}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item
              label="Tháng"
              name="month"
              rules={[{ required: true, message: "Nhập tháng" }]}
            >
              <InputNumber
                placeholder="1-12"
                min={1}
                max={12}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Chốt Kỳ
              </Button>
              <Button onClick={() => form.resetFields()}>Reset</Button>
            </Space>
          </Form>
        </Col>

        <Col xs={24} sm={8}>
          <Card size="small" style={{ backgroundColor: "#f5f5f5" }}>
            <Title level={5}>Lưu ý</Title>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              <ul>
                <li>Chốt kỳ là hành động không thể hoàn tác</li>
                <li>Các bút toán nháp sẽ bị từ chối</li>
                <li>Chỉ được chốt kỳ 1 lần</li>
              </ul>
            </Text>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default PeriodClosePage;
