// src/pages/finance/invoices/InvoiceVerifyPage.tsx
import {
  SaveOutlined,
  ArrowLeftOutlined,
  CalculatorOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Row,
  Col,
  Card,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Table,
  Typography,
  Space,
  Select,
  App,
  Empty,
  Tag,
  Grid,
} from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat"; // Import plugin
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { invoiceService } from "@/features/finance/api/invoiceService";
import { useProductStore } from "@/features/inventory/stores/productStore";

// Kích hoạt plugin parse định dạng tùy chỉnh
dayjs.extend(customParseFormat);

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const InvoiceVerifyPage = () => {
  const screens = useBreakpoint();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [form] = Form.useForm();

  const routerState = location.state?.scanResult;

  const { suppliers, fetchCommonData } = useProductStore();
  const [loading, setLoading] = useState(false);

  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isReadOnly, setIsReadOnly] = useState(false);

  // --- HÀM CHUYỂN ĐỔI NGÀY THÁNG, LUÔN LUÔN LÀ ĐỊNH DẠNG DD/MM/YYYY ---
  const parseFlexibleDate = (dateStr: string | null) => {
    if (!dateStr) return null;

    // 1. Chuẩn hóa: Thay thế dấu chấm (.) và gạch ngang (-) bằng gạch chéo (/)
    // Ví dụ: "30.11.2026" -> "30/11/2026"
    const normalizedStr = dateStr.replace(/[.-]/g, "/");

    // 2. Danh sách các định dạng ưu tiên
    const formats = [
      "DD/MM/YYYY", // 30/11/2026 (Ưu tiên Việt Nam)
      "D/M/YYYY", // 1/2/2026
      "YYYY/MM/DD", // ISO đã chuẩn hóa
      "DD/MM/YY", // 30/11/26
    ];

    for (const fmt of formats) {
      const d = dayjs(normalizedStr, fmt, true);
      if (d.isValid()) return d;
    }

    // Fallback: Thử để dayjs tự đoán lần cuối với chuỗi gốc
    const loose = dayjs(dateStr);
    return loose.isValid() ? loose : null;
  };

  useEffect(() => {
    const init = async () => {
      if (suppliers.length === 0) await fetchCommonData();

      if (routerState) {
        setInvoiceData(routerState.data);
        setFileUrl(routerState.file_url);
        fillForm(routerState.data);
      } else {
        await loadInvoiceFromDB(Number(id));
      }
    };
    init();
  }, [id]);

  const loadInvoiceFromDB = async (invoiceId: number) => {
    try {
      setLoading(true);
      const { data } = await invoiceService.getInvoices(1, 1, {
        id: invoiceId,
      });

      if (data && data.length > 0) {
        const record = data[0];
        if (record.status !== "draft") setIsReadOnly(true);

        setFileUrl(record.file_url);
        setInvoiceData(record.parsed_data || {});

        form.setFieldsValue({
          invoice_number: record.invoice_number,
          invoice_symbol: record.invoice_symbol,
          invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
          items: (record.items_json || []).map((item: any) => ({
            ...item,
            // Parse ngày khi load lại từ DB
            expiry_date: item.expiry_date ? dayjs(item.expiry_date) : null,
          })),
          supplier_id: record.supplier_id,
          total_amount_post_tax: record.total_amount_post_tax,
        });
      } else {
        message.error("Không tìm thấy hóa đơn");
        navigate("/finance/invoices");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fillForm = (data: any) => {
    form.setFieldsValue({
      invoice_number: data.invoice_number,
      invoice_symbol: data.invoice_symbol,
      // Parse ngày hóa đơn
      invoice_date: parseFlexibleDate(data.invoice_date) || dayjs(),
      supplier_id: undefined,

      items: (data.items || []).map((item: any, idx: number) => ({
        ...item,
        key: idx,
        unit_price: item.unit_price || 0,
        vat_rate: item.vat_rate || 0,
        // FIX: Parse hạn dùng với hàm mới
        expiry_date: parseFlexibleDate(item.expiry_date),
      })),
    });
    // Tính tổng tiền
    const totals = calculateTotal(form.getFieldValue("items"));
    form.setFieldsValue({ total_amount_post_tax: totals.final });
  };

  // Hàm tính toán
  const calculateTotal = (items: any[] = []) => {
    let totalPreTax = 0;
    let totalTax = 0;
    items.forEach((item: any) => {
      const qty = Number(item?.quantity) || 0;
      const price = Number(item?.unit_price) || 0;
      const vat = Number(item?.vat_rate) || 0;
      const lineTotal = qty * price;
      const lineTax = lineTotal * (vat / 100);
      totalPreTax += lineTotal;
      totalTax += lineTax;
    });
    const final = totalPreTax + totalTax;
    return { totalPreTax, totalTax, final };
  };

  const handleRecalculate = () => {
    const items = form.getFieldValue("items");
    const totals = calculateTotal(items);
    form.setFieldsValue({ total_amount_post_tax: totals.final });
    message.success(
      `Đã tính lại. Tổng tiền: ${totals.final.toLocaleString()}đ`
    );
  };

  const onFinish = async (values: any) => {
    if (isReadOnly) return;
    setLoading(true);
    try {
      const totals = calculateTotal(values.items);
      const payload = {
        invoice_number: values.invoice_number,
        invoice_symbol: values.invoice_symbol,
        invoice_date: values.invoice_date,
        supplier_id: values.supplier_id,
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,
        items_json: values.items.map((item: any) => ({
          ...item,
          // Chuẩn hóa ngày về YYYY-MM-DD trước khi lưu xuống DB
          expiry_date: item.expiry_date
            ? dayjs(item.expiry_date).format("YYYY-MM-DD")
            : null,
        })),
      };

      await invoiceService.verifyInvoice(Number(id), payload);
      message.success("Đã xác nhận hóa đơn và nhập kho!");
      navigate("/finance/invoices");
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Tên hàng",
      dataIndex: "name",
      width: 180,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "name"]} style={{ marginBottom: 0 }}>
          <Input disabled={isReadOnly} />
        </Form.Item>
      ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "unit"]} style={{ marginBottom: 0 }}>
          <Input disabled={isReadOnly} />
        </Form.Item>
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "quantity"]} style={{ marginBottom: 0 }}>
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            disabled={isReadOnly}
          />
        </Form.Item>
      ),
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 110,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "unit_price"]} style={{ marginBottom: 0 }}>
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            disabled={isReadOnly}
          />
        </Form.Item>
      ),
    },
    {
      title: "VAT %",
      dataIndex: "vat_rate",
      width: 70,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "vat_rate"]} style={{ marginBottom: 0 }}>
          <InputNumber
            min={0}
            max={100}
            style={{ width: "100%" }}
            disabled={isReadOnly}
          />
        </Form.Item>
      ),
    },
    {
      title: "Số Lô",
      dataIndex: "lot_number",
      width: 90,
      render: (_: any, __: any, index: number) => (
        <Form.Item name={[index, "lot_number"]} style={{ marginBottom: 0 }}>
          <Input disabled={isReadOnly} />
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
            disabled={isReadOnly}
            placeholder="DD/MM/YYYY"
          />
        </Form.Item>
      ),
    },
  ];

  // Render File Viewer (Responsive)
  const renderFileViewer = () => {
    if (!fileUrl) return <Empty description="Không có ảnh" />;
    const isPdf =
      fileUrl.toLowerCase().includes(".pdf") ||
      invoiceData?.file_type === "application/pdf";

    if (isPdf) {
      return (
        <iframe
          src={fileUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="PDF Preview"
        />
      );
    }
    return (
      <img
        src={fileUrl}
        alt="Invoice Scan"
        style={{ maxWidth: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
      />
    );
  };

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/finance/invoices")}
          >
            Quay lại
          </Button>
          <Title level={5} style={{ margin: 0 }}>
            {isReadOnly ? "Chi Tiết Hóa Đơn" : "Đối Chiếu Hóa Đơn"}
            {isReadOnly ? (
              <Tag color="green" style={{ marginLeft: 8 }}>
                Đã nhập
              </Tag>
            ) : null}
          </Title>
        </Space>
        {!isReadOnly && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => form.submit()}
          >
            Lưu & Nhập Kho
          </Button>
        )}
      </div>

      <Content>
        <Row style={{ height: "calc(100vh - 57px)" }}>
          {/* Ẩn cột ảnh trên Mobile để tập trung Form */}
          {screens.md ? (
            <Col
              span={10}
              style={{
                height: "100%",
                background: "#525252",
                padding: isReadOnly ? 0 : 24,
                textAlign: "center",
              }}
            >
              {renderFileViewer()}
            </Col>
          ) : null}

          <Col
            span={screens.md ? 14 : 24}
            style={{
              height: "100%",
              overflowY: "auto",
              background: "#f5f5f5",
              padding: screens.md ? 24 : 12,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              disabled={isReadOnly}
            >
              {/* Phần Thông tin chung & Chi tiết hàng hóa (Giữ nguyên nội dung Form cũ) */}
              {/* ... (Sếp copy phần Card Form từ code cũ hoặc code trên) ... */}

              <Card
                title="1. Thông tin chung"
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Số Hóa Đơn"
                      name="invoice_number"
                      rules={[{ required: true }]}
                    >
                      <Input style={{ fontWeight: "bold", color: "#1890ff" }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Ký hiệu" name="invoice_symbol">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Ngày Hóa Đơn"
                      name="invoice_date"
                      rules={[{ required: true }]}
                    >
                      <DatePicker
                        style={{ width: "100%" }}
                        format="DD/MM/YYYY"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    {!isReadOnly && (
                      <div
                        style={{ marginBottom: 4, fontSize: 12, color: "#666" }}
                      >
                        AI gợi ý NCC:{" "}
                        <strong>
                          {invoiceData?.supplier_name || "(Không đọc được)"}
                        </strong>
                      </div>
                    )}
                    <Form.Item
                      name="supplier_id"
                      rules={[{ required: true, message: "Chọn NCC" }]}
                    >
                      <Select
                        placeholder="Chọn Nhà Cung Cấp..."
                        showSearch
                        optionFilterProp="children"
                        allowClear
                      >
                        {suppliers.map((s) => (
                          <Option key={s.id} value={s.id}>
                            {s.name} - MST: {(s as any).tax_code}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card
                title={
                  <Space>
                    <span>2. Chi tiết Hàng hóa</span>
                    {!isReadOnly && (
                      <Button
                        size="small"
                        icon={<CalculatorOutlined />}
                        onClick={handleRecalculate}
                      >
                        Tính lại tổng tiền
                      </Button>
                    )}
                  </Space>
                }
                size="small"
                bodyStyle={{ padding: 0 }}
              >
                <Form.List name="items">
                  {(fields) => (
                    <Table
                      dataSource={fields}
                      columns={columns}
                      pagination={false}
                      rowKey="key"
                      size="small"
                      scroll={{ x: 950 }}
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
                    <Col span={10}>
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
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              </Card>

              {/* Nút xem ảnh trên Mobile (nếu cần) */}
              {!screens.md && (
                <Button
                  style={{ marginTop: 16, width: "100%" }}
                  onClick={() => window.open(fileUrl, "_blank")}
                >
                  Xem ảnh Hóa đơn gốc
                </Button>
              )}
            </Form>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default InvoiceVerifyPage;
