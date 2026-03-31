// src/features/finance/components/invoices/CreateInvoiceFromPO.tsx
// Tab "Tạo Hóa Đơn" - pre-fill items from PO, save & auto-link to PO
import {
  SaveOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import {
  Row,
  Col,
  Card,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Table,
  Space,
  Select,
  App,
  Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useState, useEffect } from "react";

import { VerifyProductModal } from "./VerifyProductModal";

import { invoiceService } from "@/features/finance/api/invoiceService";
import { getProductDetails } from "@/features/product/api/productService";
import { useProductStore } from "@/features/product/stores/productStore";
import { supabase } from "@/shared/lib/supabaseClient";
import { calcInvoiceTotals } from "@/shared/utils/money";

interface CreateInvoiceFromPOProps {
  poId: number | string;
  poItems: any[];
  supplierId?: number;
  onComplete?: () => void;
}

const CreateInvoiceFromPO: React.FC<CreateInvoiceFromPOProps> = ({
  poId,
  poItems,
  supplierId,
  onComplete,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { suppliers, products, fetchCommonData } = useProductStore();

  const [loading, setLoading] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [selectingRowIndex, setSelectingRowIndex] = useState<number | null>(
    null
  );
  const [selectedProductsMap, setSelectedProductsMap] = useState<
    Record<number, any>
  >({});
  // [C11] Track rows with unit conversion total deviation - blocks saving
  const [conversionErrors, setConversionErrors] = useState<Set<number>>(
    new Set()
  );

  // Init: pre-fill supplier + items from PO
  useEffect(() => {
    const init = async () => {
      if (suppliers.length === 0 || products.length === 0) {
        await fetchCommonData();
      }

      // Pre-fill supplier
      if (supplierId) {
        form.setFieldsValue({ supplier_id: supplierId });
      }

      // Pre-fill date
      form.setFieldsValue({ invoice_date: dayjs() });

      // Pre-fill items from PO
      if (poItems && poItems.length > 0) {
        const items = poItems.map((item: any, idx: number) => ({
          key: idx,
          name: item.product_name || item.name || "",
          quantity: item.quantity_ordered || item.quantity || 0,
          xml_quantity: item.quantity_ordered || item.quantity || 0,
          unit_price: item.unit_price || item.price || 0,
          xml_unit_price: item.unit_price || item.price || 0,
          vat_rate: item.vat_rate || 8,
          product_id: item.product_id || undefined,
          internal_unit: undefined,
          expiry_date: null,
        }));
        form.setFieldsValue({ items });

        // Cache products that already have IDs
        for (const item of items) {
          if (item.product_id) {
            const found = products.find((p) => p.id === item.product_id);
            if (found) {
              setSelectedProductsMap((prev) => ({
                ...prev,
                [found.id]: found,
              }));
            }
          }
        }

        handleRecalculate();
      }
    };
    init();
  }, [supplierId, poItems, suppliers.length, products.length]);

  // Calculate total
  const calculateTotal = (items: any[] = []) => calcInvoiceTotals(items);

  const handleRecalculate = () => {
    const items = form.getFieldValue("items");
    const totals = calculateTotal(items);
    form.setFieldsValue({ total_amount_post_tax: totals.final });
  };

  // Product selection
  const handleOpenVerifyModal = (index: number) => {
    setSelectingRowIndex(index);
    setIsVerifyModalOpen(true);
  };

  const handleSelectProduct = async (product: any) => {
    if (selectingRowIndex === null) return;
    let fullProduct = product;
    if (!product.product_units || product.product_units.length === 0) {
      try {
        fullProduct = await getProductDetails(product.id);
      } catch (e) {
        console.error(e);
      }
    }
    setSelectedProductsMap((prev) => ({
      ...prev,
      [fullProduct.id]: fullProduct,
    }));
    const fields = form.getFieldsValue();
    const newItems = [...fields.items];
    newItems[selectingRowIndex].product_id = fullProduct.id;
    newItems[selectingRowIndex].internal_unit = null;
    form.setFieldsValue({ items: newItems });
    setIsVerifyModalOpen(false);
    setSelectingRowIndex(null);
  };

  const handleClearProduct = (index: number) => {
    const fields = form.getFieldsValue();
    const newItems = [...fields.items];
    if (newItems[index]) {
      newItems[index].product_id = null;
      newItems[index].internal_unit = null;
      form.setFieldsValue({ items: newItems });
    }
    // Clear any conversion error for this row since product is removed
    setConversionErrors(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  // Submit: create invoice + link to PO
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let safeSupplierId = values.supplier_id
        ? Number(values.supplier_id)
        : null;
      if (typeof safeSupplierId === "number" && isNaN(safeSupplierId))
        safeSupplierId = null;
      if (!safeSupplierId) {
        message.error("Chưa chọn Nhà Cung Cấp.");
        setLoading(false);
        return;
      }

      const totals = calculateTotal(values.items);
      const payload = {
        invoice_number: values.invoice_number || "Unknown",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date
          ? dayjs(values.invoice_date).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,
        items_json: values.items.map((item: any) => ({
          ...item,
          product_id: item.product_id ? Number(item.product_id) : null,
          internal_unit: item.internal_unit || null,
          expiry_date: item.expiry_date
            ? dayjs(item.expiry_date).format("YYYY-MM-DD")
            : null,
        })),
      };

      // Create invoice as verified (confirmed)
      const result = await invoiceService.createInvoice({
        ...payload,
        status: "verified",
      });

      // Auto-link to PO
      if (result?.id || result?.[0]?.id) {
        const invoiceId = result.id || result[0].id;
        await supabase.from("finance_invoice_allocations").insert({
          invoice_id: invoiceId,
          po_id: Number(poId),
          allocated_amount: totals.final,
        });
      }

      message.success("Đã tạo hóa đơn thành công!");
      onComplete?.();
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Save draft
  const onSaveDraft = async () => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      let safeSupplierId = values.supplier_id
        ? Number(values.supplier_id)
        : null;
      if (typeof safeSupplierId === "number" && isNaN(safeSupplierId))
        safeSupplierId = null;

      const totals = calculateTotal(values.items);
      const payload = {
        invoice_number: values.invoice_number || "Draft",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date
          ? dayjs(values.invoice_date).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,
        items_json: values.items.map((item: any) => ({
          ...item,
          product_id: item.product_id ? Number(item.product_id) : null,
          expiry_date: item.expiry_date
            ? dayjs(item.expiry_date).format("YYYY-MM-DD")
            : null,
        })),
        status: "draft",
      };

      const result = await invoiceService.saveDraft(null, payload);

      // Auto-link draft to PO too
      if (result?.id || result?.[0]?.id) {
        const invoiceId = result.id || result[0].id;
        await supabase.from("finance_invoice_allocations").insert({
          invoice_id: invoiceId,
          po_id: Number(poId),
          allocated_amount: totals.final || 0,
        });
      }

      message.success("Đã lưu nháp hóa đơn!");
      onComplete?.();
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi lưu nháp: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Supplier options
  const supplierOptions = suppliers.map((s: any) => ({
    label: `${s.name} - ${s.tax_code}`,
    value: s.id,
  }));

  const filterOptionSafe = (input: string, option: any) => {
    if (!option?.label) return false;
    const tokens = input
      .toLowerCase()
      .split(/\s+/)
      .filter((t: string) => t.length > 0);
    const label = String(option.label).toLowerCase();
    return tokens.every((token: string) => label.includes(token));
  };

  // Table columns
  const columns = [
    {
      title: "Tên hàng",
      dataIndex: "name",
      width: 220,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "name"]} style={{ marginBottom: 0 }}>
          <Input
            readOnly
            variant="borderless"
            style={{
              padding: 0,
              fontWeight: 500,
              color: "#1f1f1f",
              fontSize: 13,
            }}
          />
        </Form.Item>
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 90,
      align: "center" as const,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "quantity"]} style={{ marginBottom: 0 }}>
          <InputNumber style={{ width: "100%" }} min={0} onChange={() => setTimeout(handleRecalculate, 0)} />
        </Form.Item>
      ),
    },
    {
      title: "Mã Nội Bộ (Chọn)",
      dataIndex: "product_id",
      width: 280,
      render: (_: any, _record: any, index: number) => (
        <Form.Item
          shouldUpdate={(prev: any, curr: any) =>
            prev.items?.[index]?.product_id !== curr.items?.[index]?.product_id
          }
          style={{ marginBottom: 0 }}
        >
          {({ getFieldValue }: any) => {
            const productId = getFieldValue(["items", index, "product_id"]);
            const selectedProduct =
              selectedProductsMap[productId] ||
              products.find((p) => p.id === productId);
            return (
              <div>
                <Form.Item
                  name={[index, "product_id"]}
                  style={{ display: "none" }}
                >
                  <Input />
                </Form.Item>
                {!selectedProduct ? (
                  <Button
                    type="dashed"
                    icon={<SearchOutlined />}
                    onClick={() => handleOpenVerifyModal(index)}
                    style={{ width: "100%", textAlign: "left", color: "#999" }}
                  >
                    Chọn sản phẩm...
                  </Button>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    style={{
                      border: "1px solid #91caff",
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "#e6f7ff",
                      position: "relative",
                      cursor: "pointer",
                    }}
                    onClick={() => handleOpenVerifyModal(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenVerifyModal(index);
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        zIndex: 10,
                        background: "#fff",
                        borderRadius: "50%",
                        lineHeight: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearProduct(index);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          handleClearProduct(index);
                        }
                      }}
                    >
                      <CloseCircleOutlined
                        style={{ color: "#ff4d4f", fontSize: 14 }}
                      />
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#096dd9",
                        fontSize: 12,
                      }}
                    >
                      {selectedProduct.sku}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#262626",
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedProduct.name}
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        </Form.Item>
      ),
    },
    {
      title: "ĐVT Nhập (Quy đổi)",
      dataIndex: "internal_unit",
      width: 180,
      render: (_: any, _record: any, index: number) => (
        <Form.Item
          shouldUpdate={(prev: any, curr: any) =>
            prev.items?.[index]?.product_id !==
              curr.items?.[index]?.product_id ||
            prev.items?.[index]?.internal_unit !==
              curr.items?.[index]?.internal_unit
          }
          style={{ marginBottom: 0 }}
        >
          {({ getFieldValue }: any) => {
            const productId = getFieldValue(["items", index, "product_id"]);
            const selectedProduct =
              selectedProductsMap[productId] ||
              products.find((p) => p.id === productId);
            if (!selectedProduct)
              return (
                <span
                  style={{
                    color: "#bfbfbf",
                    fontStyle: "italic",
                    fontSize: 12,
                  }}
                >
                  Chưa khớp SP
                </span>
              );

            const baseXmlQty =
              getFieldValue(["items", index, "xml_quantity"]) || 0;
            const units =
              selectedProduct.product_units || selectedProduct.units || [];

            return (
              <Form.Item
                name={[index, "internal_unit"]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="Chọn ĐVT"
                  style={{ width: "100%" }}
                  onChange={(_value, option: any) => {
                    const newRate = option?.data_rate || 1;
                    const fields = form.getFieldsValue();
                    const newItems = [...fields.items];
                    if (newItems[index]) {
                      // [C11] Capture original values before conversion
                      const originalQty = newItems[index].quantity || 0;
                      const originalPrice = newItems[index].unit_price || 0;
                      const originalTotal = originalQty * originalPrice;

                      if (baseXmlQty > 0)
                        newItems[index].quantity = baseXmlQty / newRate;
                      const basePrice = newItems[index].xml_unit_price || 0;
                      if (basePrice > 0)
                        newItems[index].unit_price = basePrice * newRate;

                      // [C11] Total preservation check after unit conversion - BLOCKING
                      const convertedQty = newItems[index].quantity || 0;
                      const convertedPrice = newItems[index].unit_price || 0;
                      const convertedTotal = convertedQty * convertedPrice;
                      const deviationPct = originalTotal > 0
                        ? (Math.abs(originalTotal - convertedTotal) / originalTotal) * 100
                        : 0;
                      if (originalTotal > 0 && deviationPct > 1) {
                        message.error(
                          `Dòng ${index + 1}: Tổng tiền sau quy đổi lệch ${deviationPct.toFixed(2)}% (>${1}%). Không thể lưu cho đến khi sửa.`
                        );
                        setConversionErrors((prev) => new Set(prev).add(index));
                      } else {
                        setConversionErrors((prev) => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        });
                      }

                      // [C11] Fractional quantity warning
                      if (convertedQty % 1 !== 0) {
                        message.warning(`Số lượng quy đổi không phải số nguyên (${convertedQty.toFixed(2)}). Kiểm tra quy cách đóng gói.`);
                      }

                      form.setFieldsValue({ items: newItems });
                      setTimeout(() => handleRecalculate(), 0);
                    }
                  }}
                >
                  {units.map((u: any) => (
                    <Select.Option
                      key={u.id}
                      value={u.id}
                      data_rate={u.conversion_rate}
                    >
                      {u.unit_name} (Rate: {u.conversion_rate})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            );
          }}
        </Form.Item>
      ),
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 130,
      align: "right" as const,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "unit_price"]} style={{ marginBottom: 0 }}>
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            onChange={() => setTimeout(handleRecalculate, 0)}
          />
        </Form.Item>
      ),
    },
    {
      title: "VAT %",
      dataIndex: "vat_rate",
      width: 70,
      align: "center" as const,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "vat_rate"]} style={{ marginBottom: 0 }}>
          <InputNumber
            min={0}
            max={100}
            style={{ width: "100%" }}
            onChange={() => setTimeout(handleRecalculate, 0)}
          />
        </Form.Item>
      ),
    },
    {
      title: "Hạn Dùng",
      dataIndex: "expiry_date",
      width: 130,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "expiry_date"]} style={{ marginBottom: 0 }}>
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
            placeholder="DD/MM/YYYY"
          />
        </Form.Item>
      ),
    },
  ];

  return (
    <div>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography.Title level={5} style={{ margin: 0 }}>
            Tạo Hóa Đơn Mới (từ Đơn Mua Hàng)
          </Typography.Title>
          <Space>
            <Button
              icon={<SaveOutlined />}
              loading={loading}
              disabled={conversionErrors.size > 0}
              onClick={onSaveDraft}
            >
              Lưu Nháp
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={loading}
              disabled={conversionErrors.size > 0}
              onClick={() => form.submit()}
            >
              Tạo Hóa Đơn
            </Button>
          </Space>
        </div>

        {/* Card 1: General Info */}
        <Card
          title="1. Thông tin chung"
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="Số Hóa Đơn"
                name="invoice_number"
                rules={[{ required: true }]}
              >
                <Input style={{ fontWeight: "bold" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Ký hiệu" name="invoice_symbol">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Ngày Hóa Đơn"
                name="invoice_date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Nhà Cung Cấp (Hệ thống)"
                name="supplier_id"
                rules={[{ required: true, message: "Chọn NCC" }]}
              >
                <Select
                  placeholder="Gõ tên hoặc MST để tìm..."
                  showSearch
                  options={supplierOptions}
                  filterOption={filterOptionSafe}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Card 2: Line Items */}
        <Card
          title="2. Chi tiết Hàng hóa (từ Đơn mua hàng)"
          size="small"
          styles={{ body: { padding: 0 } }}
        >
          <Form.List name="items">
            {(fields) => (
              <Table
                dataSource={fields}
                columns={columns}
                pagination={false}
                rowKey="key"
                size="small"
                scroll={{ x: 1200 }}
              />
            )}
          </Form.List>

          <div
            style={{
              padding: 16,
              background: "#fafafa",
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <Row justify="end">
              <Col span={6}>
                <Form.Item
                  label="Tổng thanh toán (Sau thuế)"
                  name="total_amount_post_tax"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    style={{
                      width: "100%",
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#cf1322",
                    }}
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    addonAfter="₫"
                    readOnly
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
        </Card>
      </Form>

      <VerifyProductModal
        open={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        onSelect={handleSelectProduct}
      />
    </div>
  );
};

export default CreateInvoiceFromPO;
