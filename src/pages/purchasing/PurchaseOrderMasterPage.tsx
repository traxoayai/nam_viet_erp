// src/pages/purchasing/PurchaseOrderMasterPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  SyncOutlined,
  // RobotOutlined,
  ShoppingOutlined,
  TruckOutlined,
  DollarCircleOutlined,
  EyeOutlined,
  CarOutlined,
  RocketOutlined,
  HomeOutlined,
  InboxOutlined,
  // AlertOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Button,
  Card,
  Typography,
  Space,
  Table,
  Tag,
  Progress,
  Tooltip,
  ConfigProvider,
  Popconfirm,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  App as AntApp,
  Statistic,
  Badge,
  Modal,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { purchaseOrderService } from "@/services/purchaseOrderService";
import { usePurchaseOrderStore } from "@/stores/usePurchaseOrderStore";
import { PurchaseOrderMaster } from "@/types/purchase";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
//const { Option } = Select;

// --- MAPPING TRẠNG THÁI QUY TRÌNH (STATUS) ---
const processStatusMap: any = {
  DRAFT: { color: "default", text: "Nháp", icon: <FileTextOutlined /> },
  PENDING: {
    color: "processing",
    text: "Đã đặt hàng",
    icon: <SyncOutlined spin />,
  }, // Chờ hàng về
  COMPLETED: {
    color: "success",
    text: "Hoàn tất",
    icon: <CheckCircleOutlined />,
  },
  CANCELLED: { color: "error", text: "Đã hủy", icon: <CloseCircleOutlined /> },
};

// --- MAPPING TRẠNG THÁI THANH TOÁN & GIAO HÀNG ---
const statusInfoMap: any = {
  PAYMENT: {
    paid: { color: "success", text: "Đã TT" },
    partial: { color: "warning", text: "Đã cọc" },
    unpaid: { color: "error", text: "Chưa trả" },
    overpaid: { color: "purple", text: "Dư tiền" },
  },
  // Mapping bổ sung cho Delivery nếu cần dùng icon/color trong cột Tiến độ Hàng
  DELIVERY: {
    delivered: { color: "success", text: "Đủ hàng" },
    partial: { color: "warning", text: "Thiếu hàng" },
    pending: { color: "processing", text: "Chờ hàng" },
    cancelled: { color: "default", text: "Hủy" },
  },
};

// --- MAPPING VẬN CHUYỂN (LOGISTICS) ---
const logisticsMap: any = {
  coach: { icon: <CarOutlined />, color: "orange", text: "Xe khách" },
  "3pl": { icon: <RocketOutlined />, color: "blue", text: "DV VC" },
  internal: { icon: <HomeOutlined />, color: "green", text: "Xe nhà" },
  supplier: { icon: <InboxOutlined />, color: "cyan", text: "NCC giao" },
  Unknown: { icon: <TruckOutlined />, color: "default", text: "--" },
};

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: {
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  widgetCard: {
    marginBottom: 16,
    background: "#fff",
    border: "1.5px solid #d0d7de",
    borderRadius: 8,
    padding: "16px 24px",
  },
  warningBlock: {
    border: "1px solid #ffccc7",
    background: "#fff2f0",
    borderRadius: 6,
    padding: "4px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
};

const currencyFormatter = (val: number) =>
  `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " đ";

const LogisticsWidget = ({ data }: { data: PurchaseOrderMaster[] }) => {
  const totalAmount = useMemo(
    () =>
      data.reduce((sum, order) => sum + (Number(order.final_amount) || 0), 0),
    [data]
  );

  const stats = useMemo(() => {
    const summary: any = { coach: 0, "3pl": 0, internal: 0, supplier: 0 };
    data.forEach((order) => {
      if (order.status !== "CANCELLED") {
        const method = order.delivery_method || "Unknown";
        if (summary[method] !== undefined) {
          summary[method] += Number(order.total_cartons || 0);
        }
      }
    });
    return summary;
  }, [data]);

  return (
    <div style={styles.widgetCard}>
      <Row gutter={24} align="middle">
        <Col xs={24} md={6} style={{ borderRight: "1px solid #f0f0f0" }}>
          <Statistic
            title={
              <Space>
                <DollarCircleOutlined /> Tổng Tiền Đã Đặt
              </Space>
            }
            value={totalAmount}
            precision={0}
            formatter={(v) => currencyFormatter(Number(v))}
            valueStyle={{ color: "#cf1322", fontWeight: "bold", fontSize: 24 }}
          />
        </Col>
        <Col xs={24} md={18}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Xe khách/Chành"
                value={stats["coach"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ color: "#faad14", fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Dịch vụ VC"
                value={stats["3pl"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ color: "#1890ff", fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Xe nhà"
                value={stats["internal"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ color: "#52c41a", fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="NCC giao"
                value={stats["supplier"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ color: "#13c2c2", fontSize: 18 }}
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

const PurchaseOrderMasterPage: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const navigate = useNavigate();
  const {
    orders,
    loading,
    totalCount,
    page,
    pageSize,
    fetchOrders,
    setFilters,
    setPage,
    deleteOrder,
    autoCreateOrders,
  } = usePurchaseOrderStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [bulkLogisticsMethod, setBulkLogisticsMethod] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSearch = (e: any) => {
    setSearchQuery(e.target.value);
    setFilters({ search: e.target.value });
  };
  const handleDateRangeChange = (dates: any) => {
    if (dates)
      setFilters({
        date_from: dates[0].startOf("day").toISOString(),
        date_to: dates[1].endOf("day").toISOString(),
      });
    else setFilters({ date_from: undefined, date_to: undefined });
  };

  const handleAutoCreate = async () => {
    antMessage.loading({ content: "Đang phân tích...", key: "auto" });
    if (autoCreateOrders) await autoCreateOrders("MIN_MAX");
  };

  const handleBulkDelete = async () => {
    try {
      await purchaseOrderService.bulkDeleteOrders(selectedRowKeys);
      antMessage.success(`Đã xóa ${selectedRowKeys.length} đơn hàng`);
      setSelectedRowKeys([]);
      fetchOrders();
    } catch (error) {
      antMessage.error("Xóa thất bại.");
    }
  };

  const handleBulkLogisticsUpdate = async () => {
    if (!bulkLogisticsMethod) return antMessage.warning("Chọn hình thức!");
    try {
      await purchaseOrderService.bulkUpdateLogistics(
        selectedRowKeys,
        bulkLogisticsMethod
      );
      antMessage.success("Cập nhật thành công!");
      setIsLogisticsModalOpen(false);
      setSelectedRowKeys([]);
      fetchOrders();
    } catch (error) {
      antMessage.error("Cập nhật thất bại");
    }
  };

  const columns: any = [
    {
      title: "Mã Đơn",
      dataIndex: "code",
      width: 130,
      fixed: "left",
      render: (text: string) => (
        <Text strong style={{ color: "#0969da" }}>
          {text}
        </Text>
      ),
    },
    {
      // 1. THU HẸP WIDTH TRẠNG THÁI (130 -> 110)
      title: "Trạng thái",
      key: "status",
      width: 110,
      render: (_: any, r: PurchaseOrderMaster) => {
        const status = processStatusMap[r.status] || processStatusMap["DRAFT"];
        return (
          <Tag icon={status.icon} color={status.color} style={{ margin: 0 }}>
            {status.text}
          </Tag>
        );
      },
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name",
      width: 170,
      ellipsis: true,
    },
    {
      // 2. THU HẸP WIDTH VẬN CHUYỂN (190 -> 150)
      title: "Vận chuyển",
      key: "logistics",
      width: 150,
      render: (_: any, record: PurchaseOrderMaster) => {
        const methodKey = record.delivery_method || "Unknown";
        const info = logisticsMap[methodKey] || logisticsMap["Unknown"];
        const partnerName = (record as any).shipping_partner_name;
        return (
          <Space direction="vertical" size={0}>
            <Tag icon={info.icon} color={info.color} style={{ margin: 0 }}>
              {info.text}
            </Tag>
            {partnerName ? (
              <Text style={{ fontSize: 10, color: "#1890ff" }} ellipsis>
                <TruckOutlined /> {partnerName}
              </Text>
            ) : null}
            <Space size={2} style={{ marginTop: 2 }}>
              <Badge
                count={record.total_cartons}
                overflowCount={99}
                style={{
                  backgroundColor: "#f0f2f5",
                  color: "#595959",
                  transform: "scale(0.8)",
                }}
              />
              <Text style={{ fontSize: 10 }} type="secondary">
                kiện
              </Text>
            </Space>
          </Space>
        );
      },
    },
    // 3. THU HẸP NGÀY TẠO (110 -> 100)
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      width: 100,
      render: (date: string) => dayjs(date).format("DD/MM/YY"),
    },
    // 4. THU HẸP TỔNG GIÁ TRỊ (140 -> 120)
    {
      title: "Giá Trị",
      dataIndex: "final_amount",
      width: 120,
      align: "right",
      render: (val: number) => (
        <Text strong style={{ fontSize: 13 }}>
          {currencyFormatter(val)}
        </Text>
      ),
    },
    {
      title: (
        <Space>
          <TruckOutlined /> Tiến độ Hàng
        </Space>
      ),
      width: 160,
      render: (_: any, record: PurchaseOrderMaster) => (
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 2,
            }}
          >
            <Text style={{ fontSize: 10 }} type="secondary">
              Nhập:
            </Text>
            <Text style={{ fontSize: 10 }} strong>
              {record.progress_delivery}%
            </Text>
          </div>
          <Progress
            percent={record.progress_delivery}
            size="small"
            showInfo={false}
            strokeColor="#1890ff"
          />
        </div>
      ),
    },
    // 5. KHÔI PHỤC CỘT TIẾN ĐỘ THANH TOÁN
    {
      title: (
        <Space>
          <DollarCircleOutlined /> Thanh toán
        </Space>
      ),
      width: 160,
      render: (_: any, record: PurchaseOrderMaster) => {
        const info = statusInfoMap.PAYMENT[record.payment_status] || {
          color: "default",
          text: record.payment_status,
        };
        return (
          <div style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 2,
                alignItems: "center",
              }}
            >
              <Tag
                color={info.color}
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: "16px",
                  padding: "0 4px",
                }}
              >
                {info.text}
              </Tag>
              <Text style={{ fontSize: 10 }} strong>
                {record.progress_payment}%
              </Text>
            </div>
            <Progress
              percent={record.progress_payment}
              size="small"
              showInfo={false}
              strokeColor={
                info.color === "error"
                  ? "#ff4d4f"
                  : info.color === "success"
                    ? "#52c41a"
                    : "#faad14"
              }
              status={
                record.payment_status === "overpaid" ? "exception" : "normal"
              }
            />
          </div>
        );
      },
    },
    {
      title: "Hành động",
      width: 80,
      fixed: "right",
      align: "center",
      render: (_: any, record: PurchaseOrderMaster) => (
        <Space size="small">
          <Tooltip title="Xem">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/purchase-orders/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Hủy đơn này?"
            onConfirm={() => deleteOrder(record.id)}
            disabled={record.status !== "DRAFT"}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.status !== "DRAFT"}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={styles.layout}>
        <Content style={{ padding: "12px", width: "100%", maxWidth: "100%" }}>
          <LogisticsWidget data={orders} />
          <Card style={styles.card} bodyStyle={{ padding: 0 }}>
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Space direction="vertical" size={0}>
                <Title level={4} style={{ margin: 0 }}>
                  <ShoppingOutlined /> Quản lý Đơn Mua Hàng
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Theo dõi Hàng & Tiền tập trung
                </Text>
              </Space>
              <Space>
                <Button icon={<SyncOutlined />} onClick={handleAutoCreate}>
                  Tạo Dự trù (Min/Max)
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate("/purchase-orders/new")}
                >
                  Tạo Đơn Lẻ
                </Button>
              </Space>
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "#fff",
              }}
            >
              <Row gutter={[16, 16]}>
                <Col flex="auto">
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Tìm Mã Đơn, NCC..."
                    value={searchQuery}
                    onChange={handleSearch}
                  />
                </Col>
                <Col>
                  <RangePicker
                    onChange={handleDateRangeChange}
                    placeholder={["Từ ngày", "Đến ngày"]}
                  />
                </Col>
                <Col flex="160px">
                  <Select
                    placeholder="Trạng thái"
                    allowClear
                    style={{ width: "100%" }}
                    onChange={(v) => setFilters({ status: v })}
                    options={[
                      { value: "DRAFT", label: "Nháp" },
                      { value: "PENDING", label: "Đã đặt hàng" },
                      { value: "COMPLETED", label: "Hoàn tất" },
                    ]}
                  />
                </Col>
              </Row>
            </div>
            {selectedRowKeys.length > 0 && (
              <div
                style={{
                  padding: "12px 24px",
                  background: "#e6f7ff",
                  borderBottom: "1px solid #1890ff",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <Text strong style={{ color: "#1890ff" }}>
                  Đã chọn {selectedRowKeys.length} đơn:
                </Text>
                <Button
                  icon={<TruckOutlined />}
                  onClick={() => setIsLogisticsModalOpen(true)}
                >
                  Đổi Vận chuyển
                </Button>
                <Popconfirm title="Xóa?" onConfirm={handleBulkDelete}>
                  <Button danger icon={<DeleteOutlined />}>
                    Xóa
                  </Button>
                </Popconfirm>
                <Button
                  type="text"
                  icon={<CloseCircleOutlined />}
                  onClick={() => setSelectedRowKeys([])}
                >
                  Hủy
                </Button>
              </div>
            )}
            <Table
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
              rowKey="key"
              loading={loading}
              dataSource={orders}
              columns={columns}
              bordered
              pagination={{
                current: page,
                pageSize: pageSize,
                total: totalCount,
                onChange: setPage,
                showSizeChanger: true,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Content>
        <Modal
          title="Cập nhật Vận chuyển"
          open={isLogisticsModalOpen}
          onOk={handleBulkLogisticsUpdate}
          onCancel={() => setIsLogisticsModalOpen(false)}
        >
          <p>Chọn hình thức mới:</p>
          <Select
            style={{ width: "100%" }}
            placeholder="Chọn..."
            onChange={setBulkLogisticsMethod}
            options={[
              { value: "internal", label: "Xe nhà (Tự lấy)" },
              { value: "3pl", label: "Dịch vụ vận chuyển" },
              { value: "coach", label: "Xe khách/Chành xe" },
              { value: "supplier", label: "NCC tự giao" },
            ]}
          />
        </Modal>
      </Layout>
    </ConfigProvider>
  );
};

export default PurchaseOrderMasterPage;
