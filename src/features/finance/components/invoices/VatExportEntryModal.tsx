// src/features/finance/components/invoices/VatExportEntryModal.tsx
// Modal nhập HĐ VAT đã xuất → Trừ kho hóa đơn VAT
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Table,
  Space,
  Typography,
  App,
  Select,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useCallback, useRef } from "react";

import { invoiceService } from "../../api/invoiceService";
import { moneyLineTotal, moneyMul, moneyAdd, fmtMoney } from "@/shared/utils/money";
import { supabase } from "@/shared/lib/supabaseClient";

const { Text } = Typography;

interface VatExportItem {
  key: string;
  product_id: number | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

const VatExportEntryModal: React.FC<Props> = ({ open, onCancel, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [items, setItems] = useState<VatExportItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Product search state
  const [productOptions, setProductOptions] = useState<{ value: number; label: string; name: string }[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProductSearch = useCallback((keyword: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!keyword || keyword.length < 1) {
      setProductOptions([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, sku")
          .or(`name.ilike.%${keyword}%,sku.ilike.%${keyword}%`)
          .limit(20);
        if (error) throw error;
        setProductOptions(
          (data || []).map((p: any) => ({
            value: p.id,
            label: `${p.sku ? p.sku + " - " : ""}${p.name}`,
            name: p.name,
          }))
        );
      } catch (err) {
        console.error("Product search error:", err);
      } finally {
        setProductSearchLoading(false);
      }
    }, 300);
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        key: Date.now().toString(),
        product_id: null,
        product_name: "",
        unit: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 8,
      },
    ]);
  };

  const removeItem = (key: string) => {
    setItems(items.filter((i) => i.key !== key));
  };

  const updateItem = (key: string, field: keyof VatExportItem, value: any) => {
    setItems(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  const calcTotal = () => {
    let preTax = 0;
    let tax = 0;
    items.forEach((item) => {
      const line = moneyLineTotal(item.quantity || 0, item.unit_price || 0);
      preTax = moneyAdd(preTax, line);
      tax = moneyAdd(tax, moneyMul(line, (item.vat_rate || 0) / 100));
    });
    return { preTax, tax, total: moneyAdd(preTax, tax) };
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning("Vui lòng thêm ít nhất 1 sản phẩm");
        return;
      }

      const missingProduct = items.find((i) => !i.product_id);
      if (missingProduct) {
        message.warning("Vui lòng chọn sản phẩm cho tất cả các dòng");
        return;
      }

      setLoading(true);
      const totals = calcTotal();

      const payload = {
        invoice_number: values.invoice_number,
        invoice_symbol: values.invoice_symbol,
        invoice_date: values.invoice_date
          ? dayjs(values.invoice_date).format("YYYY-MM-DD")
          : null,
        supplier_name_raw: values.buyer_name || "Khách hàng",
        buyer_tax_code: values.buyer_tax_code,
        total_amount_pre_tax: totals.preTax,
        total_tax: totals.tax,
        total_amount_post_tax: totals.total,
        direction: "outbound",
        items: items.map((item, idx) => ({
          line_number: idx + 1,
          product_id: item.product_id ? Number(item.product_id) : null,
          product_name: item.product_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          amount: item.quantity * item.unit_price,
        })),
      };

      await invoiceService.createOutboundInvoice(payload);
      message.success("Đã ghi nhận HĐ VAT xuất - Trừ kho thành công!");
      form.resetFields();
      setItems([]);
      onSuccess?.();
      onCancel();
    } catch (err: any) {
      message.error(err.message || "Lỗi ghi nhận hóa đơn xuất");
    } finally {
      setLoading(false);
    }
  };

  const totals = calcTotal();

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 260,
      render: (_: any, record: VatExportItem) => (
        <Select
          showSearch
          value={record.product_id || undefined}
          placeholder="Tìm tên hoặc SKU..."
          filterOption={false}
          onSearch={handleProductSearch}
          loading={productSearchLoading}
          options={productOptions}
          onChange={(value: number, option: any) => {
            setItems((prev) =>
              prev.map((i) =>
                i.key === record.key
                  ? { ...i, product_id: value, product_name: option?.name || option?.label || "" }
                  : i
              )
            );
          }}
          style={{ width: "100%" }}
          notFoundContent={productSearchLoading ? "Dang tim..." : "Khong tim thay"}
          allowClear
          onClear={() => {
            setItems((prev) =>
              prev.map((i) =>
                i.key === record.key ? { ...i, product_id: null, product_name: "" } : i
              )
            );
          }}
        />
      ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 100,
      render: (_: any, record: VatExportItem) => (
        <Input
          value={record.unit}
          onChange={(e) => updateItem(record.key, "unit", e.target.value)}
          placeholder="Hộp"
        />
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 80,
      render: (_: any, record: VatExportItem) => (
        <InputNumber
          value={record.quantity}
          min={1}
          onChange={(v) => updateItem(record.key, "quantity", v || 0)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 140,
      render: (_: any, record: VatExportItem) => (
        <InputNumber
          value={record.unit_price}
          min={0}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          parser={(v) => v!.replace(/,/g, "") as unknown as number}
          onChange={(v) => updateItem(record.key, "unit_price", v || 0)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "VAT%",
      dataIndex: "vat_rate",
      width: 80,
      render: (_: any, record: VatExportItem) => (
        <InputNumber
          value={record.vat_rate}
          min={0}
          max={100}
          onChange={(v) => updateItem(record.key, "vat_rate", v || 0)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Thành tiền",
      width: 120,
      render: (_: any, record: VatExportItem) => (
        <Text strong>{fmtMoney((record.quantity || 0) * (record.unit_price || 0))} ₫</Text>
      ),
    },
    {
      title: "",
      width: 40,
      render: (_: any, record: VatExportItem) => (
        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.key)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <MinusCircleOutlined style={{ color: "#ff4d4f" }} />
          Nhập HĐ VAT đã xuất (Trừ kho)
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          loading={loading}
          onClick={handleSubmit}
        >
          Xác nhận Trừ kho
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Form.Item
            name="invoice_number"
            label="Số hóa đơn"
            rules={[{ required: true, message: "Nhập số HĐ" }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="0000001" />
          </Form.Item>
          <Form.Item name="invoice_symbol" label="Ký hiệu" style={{ flex: 1 }}>
            <Input placeholder="1C26TSE" />
          </Form.Item>
          <Form.Item
            name="invoice_date"
            label="Ngày HĐ"
            rules={[{ required: true, message: "Chọn ngày" }]}
            style={{ flex: 1 }}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <Form.Item name="buyer_name" label="Tên người mua" style={{ flex: 2 }}>
            <Input placeholder="Tên khách hàng / công ty" />
          </Form.Item>
          <Form.Item name="buyer_tax_code" label="MST người mua" style={{ flex: 1 }}>
            <Input placeholder="MST (nếu có)" />
          </Form.Item>
        </div>
      </Form>

      <div style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addItem}>
          Thêm sản phẩm
        </Button>
      </div>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="small"
        locale={{ emptyText: "Chưa có sản phẩm" }}
      />

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: "#fff2f0",
          borderRadius: 6,
          border: "1px solid #ffccc7",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <Text type="secondary">Tổng trước thuế:</Text>
          <Text strong>{fmtMoney(totals.preTax)} ₫</Text>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <Text type="secondary">Thuế VAT:</Text>
          <Text strong>{fmtMoney(totals.tax)} ₫</Text>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text strong style={{ fontSize: 15, color: "#ff4d4f" }}>TỔNG CỘNG (Trừ kho):</Text>
          <Text strong style={{ fontSize: 15, color: "#ff4d4f" }}>
            {fmtMoney(totals.total)} ₫
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default VatExportEntryModal;
