import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
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
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { b2bService } from "@/features/sales/api/b2bService";
import { B2BOrderDetail } from "@/features/sales/types/b2b.types";
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

  const [order, setOrder] = useState<B2BOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
    } catch (error) {
      message.error("Cập nhật thất bại");
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

  if (!order && !loading) return <div>Không tìm thấy đơn hàng</div>;

  // Columns for Desktop Table
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      key: "product_name",
      render: (text: string, record: any) => (
        <Space>
          {record.product_image && (
            <img
              src={record.product_image}
              alt={text}
              style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
            />
          )}
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
      title: "SL",
      dataIndex: "quantity",
      key: "quantity",
      align: "center" as const,
      width: 80,
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
            {order && (
              <Tag color={B2B_STATUS_COLOR[order.status as keyof typeof B2B_STATUS_COLOR]}>
                {B2B_STATUS_LABEL[order.status as keyof typeof B2B_STATUS_LABEL]}
              </Tag>
            )}
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {order && (
          <Row gutter={[16, 16]}>
            {/* 1. INFO CARD */}
            <Col xs={24} lg={16}>
               <Card title="Thông tin khách hàng" size="small" bordered={false}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={<Space><UserOutlined /> Khách hàng</Space>}>
                      <Text strong>{order.customer_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={<Space><PhoneOutlined /> Số điện thoại</Space>}>
                       {order.customer_phone || "---"}
                    </Descriptions.Item>
                    <Descriptions.Item label={<Space><EnvironmentOutlined /> Địa chỉ giao</Space>}>
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
                   <Text type="success">-{order.discount_amount.toLocaleString()} ₫</Text>
                </Row>
                 <Row justify="space-between" style={{ marginBottom: 8 }}>
                   <Text>Phí vận chuyển:</Text>
                   <Text>{order.shipping_fee.toLocaleString()} ₫</Text>
                </Row>
                <div style={{ borderTop: "1px dashed #e8e8e8", margin: "12px 0" }} />
                <Row justify="space-between">
                   <Text strong style={{ fontSize: 16 }}>Tổng cộng:</Text>
                   <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
                     {order.final_amount.toLocaleString()} ₫
                   </Text>
                </Row>
                {order.payment_method && (
                   <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <Tag color="cyan">{order.payment_method}</Tag>
                   </div>
                )}
              </Card>
            </Col>

            {/* 3. ITEMS SECTION */}
            <Col span={24}>
              <Card title={`Danh sách sản phẩm (${order.items.length})`} size="small" bordered={false} bodyStyle={{ padding: 0 }}>
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
                      <div style={{ 
                        padding: 12, 
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex", 
                        gap: 12 
                      }}>
                         {item.product_image ? (
                             <img src={item.product_image} alt="" style={{ width: 60, height: 60, borderRadius: 4, objectFit: "cover" }} />
                         ) : (
                             <div style={{ width: 60, height: 60, background: "#f5f5f5", borderRadius: 4 }} />
                         )}
                         <div style={{ flex: 1 }}>
                            <Text strong style={{ display: 'block', marginBottom: 4 }}>{item.product_name}</Text>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666' }}>
                               <span>{item.quantity} {item.unit_name} x {item.unit_price.toLocaleString()}</span>
                               <Text strong>{item.total_price.toLocaleString()} ₫</Text>
                            </div>
                         </div>
                      </div>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>
        )}
      </Spin>

      {/* FOOTER ACTIONS */}
      <Affix offsetBottom={0}>
        <div
          style={{
            padding: "12px 24px",
            background: "#fff",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
            textAlign: "right",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          {/* Conditional Buttons based on Status */}
          {(order?.status === "DRAFT" || order?.status === "QUOTE") && (
            <>
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

          {order?.status === "CONFIRMED" && (
             <>
               <Button icon={<PrinterOutlined />}>In phiếu</Button>
               <Button type="primary">Giao hàng</Button>
             </>
          )}
           
          {order?.status === "CANCELLED" && (
             <Text type="secondary">Đơn hàng đã bị hủy</Text>
          )}
        </div>
      </Affix>
    </div>
  );
};

export default B2BOrderDetailPage;
