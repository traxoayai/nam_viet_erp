// src/pages/sales/B2BOrderDetailPage.tsx
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  EditOutlined, // [NEW]
  CheckCircleOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { SnippetsOutlined, DollarOutlined } from "@ant-design/icons"; // [NEW]
import {
  Affix,
  Button,
  Card,
  Col,
  Descriptions,
  Grid,
  List,
  message,
  Modal,
  notification,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate"; // [NEW]
import { VatActionButton } from "@/features/pos/components/VatActionButton";
import { b2bService } from "@/features/sales/api/b2bService";
import { useOrderPrint } from "@/features/sales/hooks/useOrderPrint"; // [NEW]
import { usePickingListPrint } from "@/features/sales/hooks/usePickingListPrint"; // [NEW]
import { B2BOrderDetail } from "@/features/sales/types/b2b.types";
import { FinanceFormModal } from "@/pages/finance/components/FinanceFormModal";
import {
  B2B_STATUS_COLOR,
  B2B_STATUS_LABEL,
} from "@/shared/utils/b2bConstants";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const B2BOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { printOrder } = useOrderPrint(); // [NEW]
  const { printById: printPicking, printData: pickingData } =
    usePickingListPrint(); // [NEW]

  const [order, setOrder] = useState<B2BOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [financeModalOpen, setFinanceModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder(id);
    }
  }, [id]);

  const fetchOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const data = await b2bService.getOrderDetail(orderId);
      setOrder(data);
    } catch (error) {
      console.error(error);
      message.error("Không thể tải thông tin đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await b2bService.updateStatus(id, status);
      message.success("Cập nhật trạng thái thành công");
      fetchOrder(id); // Reload data
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || "Cập nhật thất bại";
      if (
        errMsg.toLowerCase().includes("không đủ tồn kho") ||
        errMsg.toLowerCase().includes("không đủ vật tư")
      ) {
        // Hiển thị thông báo chi tiết cho lỗi kho
        notification.error({
          message: "Lỗi Tồn Kho / Vật Tư",
          description: errMsg,
          duration: 6, // Hiện lâu hơn chút để đọc
          placement: "topRight",
        });
      } else {
        message.error(errMsg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const confirmAction = (status: string, title: string) => {
    Modal.confirm({
      title,
      content: "Bạn có chắc chắn muốn thực hiện hành động này?",
      onOk: () => handleUpdateStatus(status),
    });
  };

  const handleExportExcel = () => {
    if (!order) return;

    // --- PHẦN 1: HEADER (Thông tin chung) ---
    // Sử dụng mảng 2 chiều (Array of Arrays) để tự do thiết kế layout
    const excelData: any[][] = [];
    
    excelData.push(["CHI TIẾT ĐƠN HÀNG", order.code]);
    excelData.push(["Trạng thái", B2B_STATUS_LABEL[order.status as keyof typeof B2B_STATUS_LABEL]]);
    excelData.push(["Khách hàng", order.customer_name]);
    excelData.push(["Số điện thoại", order.customer_phone || ""]);
    excelData.push(["Địa chỉ giao", order.delivery_address || ""]);
    excelData.push(["Ghi chú", order.note || ""]);
    excelData.push(["Tạm tính", order.sub_total]);
    excelData.push(["Chiết khấu", order.discount_amount]);
    excelData.push(["Phí vận chuyển", order.shipping_fee]);
    excelData.push(["Tổng cộng (Khách cần trả)", order.final_amount]);
    
    // Dòng trống phân cách
    excelData.push([]); 
    excelData.push([]); 

    // --- PHẦN 2: TABLE (Danh sách sản phẩm) ---
    // Dòng tiêu đề cột
    excelData.push([
      "STT", 
      "SKU", 
      "Tên Sản Phẩm", 
      "ĐVT", 
      "Số Lượng", 
      "Đơn Giá", 
      "Thành Tiền", 
      "Lô", 
      "HSD"
    ]);

    // Đổ dữ liệu sản phẩm
    order.items.forEach((item: any, index: number) => {
      excelData.push([
        index + 1,
        item.product?.sku || item.sku || "", // Lấy SKU từ object product lồng bên trong
        item.product_name,
        item.unit_name || item.wholesale_unit || "",
        item.quantity,
        item.unit_price,
        item.total_price,
        item.batch_no || "",
        item.expiry_date ? dayjs(item.expiry_date).format("DD/MM/YYYY") : ""
      ]);
    });

    // --- BƯỚC 3: TẠO SHEET & STYLE CƠ BẢN ---
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Căn chỉnh độ rộng cột (Auto-width cơ bản)
    ws['!cols'] = [
      { wch: 15 }, // Cột A: Tên trường / STT
      { wch: 15 }, // Cột B: Giá trị / SKU
      { wch: 40 }, // Cột C: Tên SP
      { wch: 10 }, // Cột D: ĐVT
      { wch: 10 }, // Cột E: SL
      { wch: 15 }, // Cột F: Đơn giá
      { wch: 15 }, // Cột G: Thành tiền
      { wch: 15 }, // Cột H: Lô
      { wch: 15 }, // Cột I: HSD
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chi Tiết Đơn Hàng");
    XLSX.writeFile(wb, `Don_Hang_${order.code}.xlsx`);
  };

  if (!order && !loading) return <div>Không tìm thấy đơn hàng</div>;

  // Columns for Desktop Table
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      key: "product_name",
      render: (text: string, record: any) => (
        <Space>
          {record.product_image ? (
            <img
              src={record.product_image}
              alt={text}
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ) : null}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: "Đơn vị",
      dataIndex: "unit_name",
      key: "unit_name",
      width: 80,
    },
    {
      title: "Lô / HSD",
      key: "batch_info",
      width: 140,
      render: (_: any, record: any) => (
        <div>
          {record.batch_no ? (
             <Tag color="blue" style={{ fontWeight: 'bold', margin: 0 }}>{record.batch_no}</Tag>
          ) : (
             <Tag color="default" style={{ margin: 0 }}>Chưa xuất</Tag>
          )}
          {record.expiry_date && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              HSD: {dayjs(record.expiry_date).format('DD/MM/YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "SL",
      dataIndex: "quantity",
      key: "quantity",
      align: "center" as const,
      width: 80,
      render: (qty: number, record: any) => {
        const returned = record.quantity_returned || 0;
        return (
          <div style={{ textAlign: 'center' }}>
            <Text strong>{qty}</Text>
            {returned > 0 && (
              <div style={{ fontSize: 12, color: '#cf1322', marginTop: 4 }}>
                (Đã trả: {returned})
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      key: "unit_price",
      align: "right" as const,
      render: (val: number) => val.toLocaleString() + " ₫",
    },
    {
      title: "Thành tiền",
      dataIndex: "total_price",
      key: "total_price",
      align: "right" as const,
      render: (val: number) => <Text strong>{val.toLocaleString()} ₫</Text>,
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, paddingBottom: 80 }}>
      {/* HEADER */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/b2b/orders")}
            />
            <Title level={4} style={{ margin: 0 }}>
              Đơn hàng #{order?.code}
            </Title>
            {order ? (
              <Tag
                color={
                  B2B_STATUS_COLOR[
                    order.status as keyof typeof B2B_STATUS_COLOR
                  ]
                }
              >
                {
                  B2B_STATUS_LABEL[
                    order.status as keyof typeof B2B_STATUS_LABEL
                  ]
                }
              </Tag>
            ) : null}
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {order ? (
          <Row gutter={[16, 16]}>
            {/* 1. INFO CARD */}
            <Col xs={24} lg={16}>
              <Card title="Thông tin khách hàng" size="small" bordered={false}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item
                    label={
                      <Space>
                        <UserOutlined /> Khách hàng
                      </Space>
                    }
                  >
                    <Text strong>{order.customer_name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <Space>
                        <PhoneOutlined /> Số điện thoại
                      </Space>
                    }
                  >
                    {order.customer_phone || "---"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <Space>
                        <EnvironmentOutlined /> Địa chỉ giao
                      </Space>
                    }
                  >
                    {order.delivery_address || "---"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú">
                    {order.note || "Không có ghi chú"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* 2. PAYMENT SUMMARY CARD (Right side on Desktop) */}
            <Col xs={24} lg={8}>
              <Card title="Thanh toán" size="small" bordered={false}>
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Text>Tạm tính:</Text>
                  <Text>{order.sub_total.toLocaleString()} ₫</Text>
                </Row>
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Text>Chiết khấu:</Text>
                  <Text type="success">
                    -{order.discount_amount.toLocaleString()} ₫
                  </Text>
                </Row>
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Text>Phí vận chuyển:</Text>
                  <Text>{order.shipping_fee.toLocaleString()} ₫</Text>
                </Row>
                <div
                  style={{ borderTop: "1px dashed #e8e8e8", margin: "12px 0" }}
                />
                <Row justify="space-between">
                  <Text strong style={{ fontSize: 16 }}>
                    Tổng cộng:
                  </Text>
                  <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
                    {order.final_amount.toLocaleString()} ₫
                  </Text>
                </Row>
                {order.payment_method ? (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <Tag color="cyan">{order.payment_method}</Tag>
                  </div>
                ) : null}
              </Card>
            </Col>

            {/* 3. ITEMS SECTION */}
            <Col span={24}>
              <Card
                title={`Danh sách sản phẩm (${order.items.length})`}
                size="small"
                bordered={false}
                bodyStyle={{ padding: 0 }}
              >
                {screens.md ? (
                  // DESKTOP: TABLE
                  <Table
                    dataSource={order.items}
                    columns={columns}
                    rowKey="id"
                    pagination={false}
                  />
                ) : (
                  // MOBILE: LIST OF CARDS
                  <List
                    dataSource={order.items}
                    renderItem={(item) => (
                      <div
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #f0f0f0",
                          display: "flex",
                          gap: 12,
                        }}
                      >
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt=""
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 4,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 60,
                              height: 60,
                              background: "#f5f5f5",
                              borderRadius: 4,
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <Text
                            strong
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            {item.product_name}
                          </Text>
                          <div style={{ marginBottom: 4 }}>
                            {item.batch_no ? (
                              <Tag color="blue" style={{ fontSize: 10, lineHeight: '14px' }}>Lô: {item.batch_no}</Tag>
                            ) : (
                              <Tag color="default" style={{ fontSize: 10, lineHeight: '14px' }}>Chưa xuất kho</Tag>
                            )}
                            {item.expiry_date && (
                              <span style={{ fontSize: 11, color: '#888' }}>
                                HSD: {dayjs(item.expiry_date).format('DD/MM/YYYY')}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 13,
                              color: "#666",
                            }}
                          >
                            <span>
                              {item.quantity} {item.unit_name} x{" "}
                              {item.unit_price.toLocaleString()}
                            </span>
                            <Text strong>
                              {item.total_price.toLocaleString()} ₫
                            </Text>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
        ) : null}
      </Spin>

      {/* FOOTER ACTIONS */}
      {/* FOOTER ACTIONS */}
      <Affix offsetBottom={0}>
        <div
          style={{
            background: "#fff",
            padding: "10px 24px",
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          {/* 1. Nút Xuất VAT (Luôn hiện bên trái) */}
          <div style={{ marginRight: "auto" }}>
            {order ? (
              <VatActionButton
                /* ... Giữ nguyên props cũ ... */
                invoice={
                  order.sales_invoices
                    ? {
                        id: order.sales_invoices.id,
                        status: order.sales_invoices.status,
                        code: order.sales_invoices.invoice_number || order.code,
                      }
                    : { id: -1, status: "pending", code: order.code }
                }
                orderItems={order.items.map((item: any) => ({
                  ...item,
                  id: Number(item.product_id),
                  name: item.product_name,
                  unit:
                    item.unit_name ||
                    item.wholesale_unit ||
                    item.retail_unit ||
                    "Cái",
                  price: Number(item.unit_price) || 0,
                  qty: Number(item.quantity) || 0,
                }))}
                customer={{
                  name: order.customer_name,
                  phone: order.customer_phone,
                  tax_code: order.tax_code,
                  address: order.delivery_address,
                  email: order.customer_email,
                }}
                onUpdate={() => {
                  if (id) {
                    setLoading(true);
                    b2bService.getOrderDetail(id).then((data) => {
                      setOrder(data);
                      setLoading(false);
                    });
                  }
                }}
              />
            ) : null}
          </div>

          {/* 2. CÁC NÚT IN ẤN (LUÔN HIỆN TRỪ KHI ĐÃ HỦY) */}
          {order?.status !== "CANCELLED" && (
            <>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ color: '#52c41a', borderColor: '#52c41a' }}>
                Xuất Excel
              </Button>

              <Button
                icon={<SnippetsOutlined />}
                onClick={() => order && printPicking(order.id)}
              >
                In Phiếu Nhặt
              </Button>

              <Button
                icon={<PrinterOutlined />}
                onClick={() => order && printOrder(order)}
              >
                In Đơn
              </Button>
            </>
          )}

          {/* 2.5. NÚT TẠO PHIẾU THU (chỉ hiện khi đơn chưa thanh toán đủ) */}
          {order &&
            order.status !== "CANCELLED" &&
            order.status !== "DRAFT" &&
            order.status !== "QUOTE" &&
            order.payment_status !== "paid" && (
              <Button
                icon={<DollarOutlined />}
                style={{ color: "#faad14", borderColor: "#faad14" }}
                onClick={() => setFinanceModalOpen(true)}
              >
                Tạo Phiếu Thu
              </Button>
            )}

          {/* 3. CÁC NÚT THAO TÁC (TÙY TRẠNG THÁI) */}
          {(order?.status === "DRAFT" || order?.status === "QUOTE") && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/b2b/orders/edit/${order.id}`)}
              >
                Sửa đơn
              </Button>

              <Button
                danger
                onClick={() => confirmAction("CANCELLED", "Hủy đơn hàng")}
                loading={actionLoading}
              >
                Hủy đơn
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => confirmAction("CONFIRMED", "Chốt đơn hàng")}
                loading={actionLoading}
              >
                Chốt đơn
              </Button>
            </>
          )}

          {/* {order?.status === "CONFIRMED" && (
            <Button
              onClick={() => handleUpdateStatus("SHIPPING")} // Logic cũ là DELIVERED, nên đổi thành SHIPPING hoặc DELIVERED tùy quy trình
              type="primary"
            >
              Giao hàng
            </Button>
          )} */}

          {order?.status === "SHIPPING" && (
            <Button
              onClick={() => handleUpdateStatus("DELIVERED")}
              type="primary"
            >
              Hoàn tất đơn
            </Button>
          )}

          {order?.status === "CANCELLED" && (
            <Text type="secondary">Đơn hàng đã bị hủy</Text>
          )}
        </div>
      </Affix>

      {/* FINANCE MODAL */}
      <FinanceFormModal
        open={financeModalOpen}
        onCancel={() => setFinanceModalOpen(false)}
        initialFlow="in"
        onSuccess={() => {
          setFinanceModalOpen(false);
          if (id) fetchOrder(id);
          message.success("Đã lập phiếu thu thành công!");
        }}
        initialValues={
          order
            ? {
                business_type: "trade",
                partner_type: "customer_b2b",
                partner_id: order.customer_id,
                partner_name: order.customer_name,
                amount: Math.max(
                  0,
                  order.final_amount - (order.paid_amount || 0)
                ),
                ref_type: "order",
                ref_id: order.code,
                description: `Thu tiền đơn hàng ${order.code}`,
                payment_method: order.payment_method,
              }
            : undefined
        }
      />

      {/* [NEW] HIDDEN PICKING PRINT */}
      {pickingData ? (
        <PickingListTemplate
          orderInfo={pickingData.orderInfo}
          items={pickingData.items}
        />
      ) : null}
    </div>
  );
};

export default B2BOrderDetailPage;
