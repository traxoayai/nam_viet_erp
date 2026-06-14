/**
 * Invoice Form with Multi-VAT support per line item
 * Supports discount, fee, and VAT calculation (0%, 5%, 10%)
 * Includes upload section to extract invoice data
 */
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Form,
  Card,
  Table,
  Button,
  InputNumber,
  Select,
  Input,
  DatePicker,
  Typography,
  message,
  Upload,
  Spin,
} from "antd";
import dayjs from "dayjs";
import React, { useState } from "react";

import type {
  InvoiceLineItem,
  InvoiceFormData,
  InvoiceSubmitPayload,
  VatRate,
} from "@/features/finance/types/invoiceTypes";

import { validateInvoiceDiscounts } from "@/features/finance/api/invoiceValidationService";
import { useInvoiceExtraction } from "@/features/finance/hooks/useInvoiceExtraction";
import { calculateInvoiceSummary } from "@/features/finance/utils/invoiceLineCalculations";

const { Text } = Typography;

interface InvoiceMultiVatFormProps {
  onSubmit: (payload: InvoiceSubmitPayload) => Promise<void>;
  initialData?: Partial<InvoiceFormData>;
  loading?: boolean;
}

export default function InvoiceMultiVatForm({
  onSubmit,
  initialData,
  loading,
}: InvoiceMultiVatFormProps): React.ReactElement {
  const [form] = Form.useForm<InvoiceFormData>();
  const [lines, setLines] = useState<InvoiceLineItem[]>(
    initialData?.items || []
  );
  const { uploadAndExtract, loading: extracting } = useInvoiceExtraction();

  const handleUploadInvoice = async (file: File) => {
    // Build product lookup map (from invoice db or user's product list)
    const productLookup: Record<string, number> = {};
    // TODO: Populate from actual product database

    const extracted = await uploadAndExtract(file, productLookup);
    if (extracted?.items && extracted.items.length > 0) {
      // Autofill form fields
      form.setFieldsValue({
        customer_name: extracted.customer_name || "",
        invoice_number: extracted.invoice_number || "",
      });
      // Set items
      setLines(extracted.items);
      message.success("Tải hóa đơn thành công! Vui lòng kiểm tra và xác nhận.");
    } else {
      message.warning(
        "Không lấy được dữ liệu từ hóa đơn. Vui lòng nhập thủ công."
      );
    }
    return false; // Prevent default upload
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        key: `l-${Date.now()}-${Math.random()}`,
        product_name: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 10,
        discount_amount: 0,
      },
    ]);
  };
  const removeLine = (key: string) =>
    setLines(lines.filter((l) => l.key !== key));
  const updateLine = (
    key: string,
    field: keyof InvoiceLineItem,
    value: unknown
  ) => {
    setLines(lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };
  const calculateLine = (line: InvoiceLineItem) => {
    const subtotal = line.quantity * line.unit_price;
    const afterDiscount = Math.max(0, subtotal - (line.discount_amount || 0));
    const tax = afterDiscount * ((line.vat_rate as number) / 100);
    return { subtotal, afterDiscount, tax, total: afterDiscount + tax };
  };

  const handleSubmit = async (values: InvoiceFormData) => {
    if (lines.length === 0) {
      message.error("Ít nhất 1 dòng hàng");
      return;
    }

    try {
      // Build items_json for validation
      const itemsJson = {
        lines: lines.map((line) => {
          const calc = calculateLine(line);
          return {
            product_id: line.product_id,
            product_name: line.product_name,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_amount: line.discount_amount || 0,
            vat_rate: line.vat_rate,
            vat_amount: calc.tax,
            line_total: calc.total,
          };
        }),
      };

      // Validate discount caps before submission
      const discountTotal = values.discount_total || 0;
      const validationResult = await validateInvoiceDiscounts(
        itemsJson,
        discountTotal
      );
      if (!validationResult.valid) {
        message.error(
          validationResult.error || "Chiết khấu vượt quá giới hạn cho phép"
        );
        return; // Stop submission
      }

      const summary = calculateInvoiceSummary(
        lines,
        discountTotal,
        values.fee_total || 0
      );

      const payload: InvoiceSubmitPayload = {
        invoice_number: values.invoice_number,
        invoice_date: values.invoice_date.format("YYYY-MM-DD"),
        customer_name: values.customer_name,
        customer_tax_code: values.customer_tax_code,
        customer_address: values.customer_address,
        items_json: itemsJson,
        discount_total: discountTotal,
        fee_total: values.fee_total || 0,
        notes: values.notes,
        summary,
      };

      await onSubmit(payload);
      message.success("Lưu hóa đơn thành công");
      form.resetFields();
      setLines([]);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Lỗi khi lưu hóa đơn"
      );
    }
  };

  const columns = [
    {
      title: "Tên SP",
      dataIndex: "product_name",
      width: 150,
      render: (_: string, record: InvoiceLineItem) => (
        <Input
          value={record.product_name}
          onChange={(e) =>
            updateLine(record.key, "product_name", e.target.value)
          }
          placeholder="Nhập tên SP"
          size="small"
        />
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 80,
      render: (_: number, record: InvoiceLineItem) => (
        <InputNumber
          value={record.quantity}
          onChange={(v) => updateLine(record.key, "quantity", v || 0)}
          min={0}
          size="small"
        />
      ),
    },
    {
      title: "Giá/Cái",
      dataIndex: "unit_price",
      width: 100,
      render: (_: number, record: InvoiceLineItem) => (
        <InputNumber
          value={record.unit_price}
          onChange={(v) => updateLine(record.key, "unit_price", v || 0)}
          min={0}
          size="small"
        />
      ),
    },
    {
      title: "Chiết Khấu",
      dataIndex: "discount_amount",
      width: 100,
      render: (_: number, record: InvoiceLineItem) => (
        <InputNumber
          value={record.discount_amount || 0}
          onChange={(v) => updateLine(record.key, "discount_amount", v || 0)}
          min={0}
          size="small"
        />
      ),
    },
    {
      title: "VAT %",
      dataIndex: "vat_rate",
      width: 80,
      render: (_: VatRate, record: InvoiceLineItem) => (
        <Select
          value={record.vat_rate}
          onChange={(v) => updateLine(record.key, "vat_rate", v)}
          options={[
            { label: "0%", value: 0 },
            { label: "5%", value: 5 },
            { label: "10%", value: 10 },
          ]}
          size="small"
        />
      ),
    },
    {
      title: "Thành Tiền",
      width: 120,
      render: (_: unknown, record: InvoiceLineItem) => (
        <Text strong>
          {calculateLine(record).total.toLocaleString("vi-VN")}
        </Text>
      ),
    },
    {
      title: "Hành Động",
      width: 80,
      render: (_: unknown, record: InvoiceLineItem) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.key)}
        />
      ),
    },
  ];

  const summary = calculateInvoiceSummary(
    lines,
    form.getFieldValue("discount_total") || 0,
    form.getFieldValue("fee_total") || 0
  );

  return (
    <Form<InvoiceFormData>
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        invoice_date: dayjs(),
        ...initialData,
      }}
    >
      <Card title="1. Thông Tin Hóa Đơn">
        <Form.Item
          label="Số Hóa Đơn"
          name="invoice_number"
          rules={[{ required: true, message: "Nhập số hóa đơn" }]}
        >
          <Input placeholder="VD: HĐ-2025-001" />
        </Form.Item>

        <Form.Item
          label="Ngày Hóa Đơn"
          name="invoice_date"
          rules={[{ required: true, message: "Chọn ngày" }]}
        >
          <DatePicker />
        </Form.Item>

        <Form.Item
          label="Tên Khách Hàng"
          name="customer_name"
          rules={[{ required: true, message: "Nhập tên khách" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="MST (Mã Số Thuế)"
          name="customer_tax_code"
          rules={[{ required: true, message: "MST bắt buộc" }]}
        >
          <Input placeholder="VD: 0123456789" />
        </Form.Item>

        <Form.Item label="Địa Chỉ" name="customer_address">
          <Input />
        </Form.Item>
      </Card>

      <Card title="2. Chi Tiết Dòng Hàng" style={{ marginTop: 16 }}>
        {/* Upload Section */}
        <Spin spinning={extracting}>
          <Upload
            beforeUpload={handleUploadInvoice}
            accept=".pdf,.jpg,.jpeg,.png"
            maxCount={1}
            style={{ marginBottom: 16 }}
          >
            <Button
              icon={<UploadOutlined />}
              loading={extracting}
              disabled={extracting}
            >
              Tải hóa đơn (PDF/Ảnh)
            </Button>
          </Upload>
        </Spin>

        <Table
          dataSource={lines}
          columns={columns}
          pagination={false}
          size="small"
          rowKey="key"
        />
        <Button
          onClick={addLine}
          type="dashed"
          icon={<PlusOutlined />}
          block
          style={{ marginTop: 8 }}
        >
          Thêm Dòng
        </Button>

        <Card style={{ marginTop: 16 }} size="small">
          <Text>
            Tổng: {summary.total_goods.toLocaleString("vi-VN")} | Chiết:{" "}
            {summary.total_discount.toLocaleString("vi-VN")} | Trước thuế:{" "}
            {summary.total_pre_tax.toLocaleString("vi-VN")}
          </Text>
          <br />
          <Text strong>
            VAT: {summary.total_tax.toLocaleString("vi-VN")} | Sau thuế:{" "}
            {summary.total_post_tax.toLocaleString("vi-VN")} VND
          </Text>
        </Card>
      </Card>

      <Card title="3. Phí & Chiết Khấu Chung" style={{ marginTop: 16 }}>
        <Form.Item label="Chiết Khấu Tổng (VND)" name="discount_total">
          <InputNumber min={0} />
        </Form.Item>

        <Form.Item label="Phí Mua Hàng (VND)" name="fee_total">
          <InputNumber min={0} />
        </Form.Item>

        <Form.Item label="Ghi Chú" name="notes">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Card>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" loading={loading} size="large">
          Lưu Hóa Đơn
        </Button>
      </Form.Item>
    </Form>
  );
}
