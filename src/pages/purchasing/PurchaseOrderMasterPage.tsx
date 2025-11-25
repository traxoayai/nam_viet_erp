// src/pages/purchasing/PurchaseOrderMasterPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  SyncOutlined,
  RobotOutlined,
  ShoppingOutlined,
  TruckOutlined,
  DollarCircleOutlined,
  EyeOutlined,
  CarOutlined,
  RocketOutlined,
  HomeOutlined,
  InboxOutlined,
  AlertOutlined,
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
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useEffect, useState, useMemo } from "react";

import { usePurchaseOrderStore } from "@/stores/usePurchaseOrderStore";
import { PurchaseOrderMaster } from "@/types/purchase";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: {
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  // Style cho Widget Logistics
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

const statusInfoMap: any = {
  DELIVERY: {
    delivered: { color: "green", text: "Đã nhập đủ", icon: <TruckOutlined /> },
    partial: { color: "orange", text: "Về một phần", icon: null },
    pending: { color: "blue", text: "Chờ hàng về", icon: null },
    cancelled: { color: "default", text: "Đã hủy", icon: null },
  },
  PAYMENT: {
    paid: {
      color: "green",
      text: "Đã thanh toán",
      icon: <DollarCircleOutlined />,
    },
    partial: { color: "geekblue", text: "Đã cọc/Trả bớt", icon: null },
    unpaid: { color: "error", text: "Chưa trả tiền", icon: null },
    overpaid: { color: "purple", text: "Trả thừa", icon: null },
  },
};

// Mapping màu sắc và icon cho vận chuyển
const logisticsMap: any = {
  "Xe khách/Chành xe": { icon: <CarOutlined />, color: "orange" },
  "Dịch vụ vận chuyển": { icon: <RocketOutlined />, color: "blue" },
  "Xe nhà (Tự lấy)": { icon: <HomeOutlined />, color: "green" },
  "NCC tự giao": { icon: <InboxOutlined />, color: "cyan" },
  Unknown: { icon: <TruckOutlined />, color: "default" },
};

// --- COMPONENT CON: WIDGET LOGISTICS ---
const LogisticsWidget = ({ data }: { data: PurchaseOrderMaster[] }) => {
  const stats = useMemo(() => {
    const summary: any = {
      "Xe khách/Chành xe": 0,
      "Dịch vụ vận chuyển": 0,
      "Xe nhà (Tự lấy)": 0,
      "NCC tự giao": 0,
    };

    data.forEach((order) => {
      // Chỉ tính các đơn chưa hoàn tất nhập kho
      if (
        order.delivery_status !== "delivered" &&
        order.delivery_status !== "cancelled"
      ) {
        const method = order.delivery_method || "Unknown";
        if (!summary[method]) summary[method] = 0;
        summary[method] += Number(order.total_cartons || 0);
      }
    });
    return summary;
  }, [data]);

  // Cảnh báo nếu xe khách > 50 thùng
  const xeKhachCount = stats["Xe khách/Chành xe"] || 0;
  const showWarning = xeKhachCount > 50;

  return (
    <div style={styles.widgetCard}>
      <Row gutter={24} align="middle">
        <Col xs={24} md={6}>
          <Space direction="vertical" size={2}>
            <Title level={5} style={{ margin: 0, color: "#57606a" }}>
              <InboxOutlined /> Tổng hợp Logistics
            </Title>
            <Text type="secondary">Dự kiến hàng về (Chưa nhập kho)</Text>
          </Space>
        </Col>
        <Col xs={24} md={18}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title={
                  <Space>
                    <CarOutlined /> Xe khách/Chành
                  </Space>
                }
                value={xeKhachCount}
                precision={1}
                suffix="thùng"
                valueStyle={{
                  color: showWarning ? "#cf222e" : "#0969da",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              />
              {showWarning ? (
                <div style={styles.warningBlock}>
                  <AlertOutlined style={{ color: "#cf222e" }} />
                  <Text type="danger" strong style={{ fontSize: 11 }}>
                    Nên điều xe nhà!
                  </Text>
                </div>
              ) : null}
            </Col>
            <Col span={6}>
              <Statistic
                title="NCC tự giao"
                value={stats["NCC tự giao"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Dịch vụ VC"
                value={stats["Dịch vụ vận chuyển"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Xe nhà"
                value={stats["Xe nhà (Tự lấy)"]}
                precision={1}
                suffix="thùng"
                valueStyle={{ color: "green", fontSize: 18 }}
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

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSearch = (e: any) => {
    setSearchQuery(e.target.value);
    setFilters({ search: e.target.value });
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setFilters({
        date_from: dates[0].startOf("day").toISOString(),
        date_to: dates[1].endOf("day").toISOString(),
      });
    } else {
      setFilters({ date_from: undefined, date_to: undefined });
    }
  };

  const handleAutoCreate = async () => {
    antMessage.loading({ content: "Đang phân tích tồn kho...", key: "auto" });
    // Giả định store đã có hàm này (Sếp đã thêm ở Turn trước)
    if (autoCreateOrders) {
      await autoCreateOrders("MIN_MAX");
    }
  };

  const columns: any = [
    {
      title: "Mã Đơn",
      dataIndex: "code",
      width: 140,
      fixed: "left",
      render: (text: string) => (
        <Text strong style={{ color: "#0969da" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name",
      width: 180,
      ellipsis: true,
    },
    // --- CỘT MỚI: LOGISTICS ---
    {
      title: "Vận chuyển",
      key: "logistics",
      width: 170,
      render: (_: any, record: PurchaseOrderMaster) => {
        const methodKey = record.delivery_method || "Unknown";
        const methodInfo = logisticsMap[methodKey] || logisticsMap["Unknown"];

        return (
          <Space direction="vertical" size={0}>
            <Tag
              icon={methodInfo.icon}
              color={methodInfo.color}
              style={{ margin: 0 }}
            >
              {methodKey}
            </Tag>
            <Space style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                SL:
              </Text>
              <Badge
                count={record.total_cartons}
                overflowCount={999}
                style={{
                  backgroundColor: "#f0f2f5",
                  color: "#595959",
                  boxShadow: "inset 0 0 0 1px #d9d9d9",
                }}
              />
              <Text style={{ fontSize: 11 }}>thùng</Text>
            </Space>
          </Space>
        );
      },
    },
    // --------------------------
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      width: 110,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Tổng Giá Trị",
      dataIndex: "final_amount",
      width: 140,
      align: "right",
      render: (val: number) => <Text strong>{currencyFormatter(val)}</Text>,
    },
    {
      title: (
        <Space>
          <TruckOutlined /> Tiến độ Hàng
        </Space>
      ),
      width: 200,
      render: (_: any, record: PurchaseOrderMaster) => {
        const info = statusInfoMap.DELIVERY[record.delivery_status] || {
          color: "default",
          text: record.delivery_status,
        };
        return (
          <div style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Tag color={info.color} style={{ margin: 0, fontSize: 11 }}>
                {info.text}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.progress_delivery}%
              </Text>
            </div>
            <Progress
              percent={record.progress_delivery}
              size="small"
              strokeColor={
                info.color === "orange"
                  ? "#faad14"
                  : info.color === "green"
                    ? "#52c41a"
                    : "#1890ff"
              }
              showInfo={false}
              trailColor="#f0f0f0"
            />
          </div>
        );
      },
    },
    {
      title: (
        <Space>
          <DollarCircleOutlined /> Tiến độ Tiền
        </Space>
      ),
      width: 200,
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
                marginBottom: 4,
              }}
            >
              <Tag color={info.color} style={{ margin: 0, fontSize: 11 }}>
                {info.text}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.progress_payment}%
              </Text>
            </div>
            <Progress
              percent={record.progress_payment}
              size="small"
              status={
                record.payment_status === "overpaid" ? "exception" : "normal"
              }
              strokeColor={
                info.color === "error"
                  ? "#ff4d4f"
                  : info.color === "green"
                    ? "#52c41a"
                    : "#1890ff"
              }
              showInfo={false}
              trailColor="#f0f0f0"
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
          <Tooltip title="Xem chi tiết">
            <Button size="small" type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Popconfirm
            title="Hủy đơn này?"
            onConfirm={() => deleteOrder(record.id)}
            disabled={record.delivery_status !== "pending"}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.delivery_status !== "pending"}
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
          {/* WIDGET LOGISTICS MỚI */}
          <LogisticsWidget data={orders} />

          <Card style={styles.card} bodyStyle={{ padding: 0 }}>
            {/* HEADER */}
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
                  Theo dõi Hàng & Tiền tập trung (Master View)
                </Text>
              </Space>
              <Space>
                <Button icon={<SyncOutlined />} onClick={handleAutoCreate}>
                  Tạo Dự trù (Min/Max)
                </Button>
                <Button icon={<RobotOutlined />} type="dashed">
                  Dự trù AI
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => antMessage.info("Tính năng đang phát triển")}
                >
                  Tạo Đơn Lẻ
                </Button>
              </Space>
            </div>

            {/* FILTER */}
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
                    allowClear
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
                <Col flex="180px">
                  <Select
                    placeholder="Tiến độ Hàng"
                    allowClear
                    style={{ width: "100%" }}
                    onChange={(v) => setFilters({ delivery_status: v })}
                    options={[
                      { value: "pending", label: "Chờ hàng về" },
                      { value: "partial", label: "Về một phần" },
                      { value: "delivered", label: "Đã nhập đủ" },
                    ]}
                  />
                </Col>
                <Col flex="180px">
                  <Select
                    placeholder="Tiến độ Tiền"
                    allowClear
                    style={{ width: "100%" }}
                    onChange={(v) => setFilters({ payment_status: v })}
                    options={[
                      { value: "unpaid", label: "Chưa trả tiền" },
                      { value: "partial", label: "Đã cọc/Trả bớt" },
                      { value: "paid", label: "Đã thanh toán" },
                    ]}
                  />
                </Col>
              </Row>
            </div>

            <Table
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
      </Layout>
    </ConfigProvider>
  );
};

export default PurchaseOrderMasterPage;
