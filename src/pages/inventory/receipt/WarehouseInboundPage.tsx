// src/pages/inventory/receipt/WarehouseInboundPage.tsx
import {
  SearchOutlined,
  SyncOutlined,
  DownloadOutlined,
  TruckOutlined,
  HomeOutlined,
  RocketOutlined,
  InboxOutlined,
  CarOutlined,
  CodeSandboxOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  DatePicker,
  Row,
  Col,
  Statistic,
  Badge,
  Tooltip,
  Tabs,
  App,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";
import { purchaseOrderService } from "@/services/purchaseOrderService";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const logisticsMap: any = {
  coach: { icon: <CarOutlined />, color: "orange", text: "Xe khách" },
  "3pl": { icon: <RocketOutlined />, color: "blue", text: "DV Vận chuyển" },
  internal: { icon: <HomeOutlined />, color: "green", text: "Xe nhà" },
  supplier: { icon: <InboxOutlined />, color: "cyan", text: "NCC giao" },
  Unknown: { icon: <TruckOutlined />, color: "default", text: "--" },
};

const WarehouseInboundPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState<any>({});

  // FIX 1: Thêm Tab để quản lý trạng thái
  const [activeTab, setActiveTab] = useState<string>("pending");

  useEffect(() => {
    fetchData();

    // FIX 3: REAL-TIME LISTENER
    // Lắng nghe mọi thay đổi trên bảng purchase_orders
    const channel = supabase
      .channel("realtime_inbound_orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_orders" },
        (payload) => {
          // Khi có thay đổi (kế toán tạo đơn, hoặc kho nhập xong), tự động load lại
          console.log("Realtime Update:", payload);
          fetchData();
          message.info("Dữ liệu vừa được cập nhật tự động");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pagination.current, JSON.stringify(filters), activeTab]); // Reload khi đổi tab

  const fetchData = async () => {
    setLoading(true);
    try {
      // Logic lọc theo Tab
      // Tab 'pending': Lấy đơn chờ (pending, partial)
      // Tab 'history': Lấy đơn xong (delivered)
      const statusFilter = activeTab === "pending" ? "pending" : "delivered";

      const { data: resData, totalCount } = await purchaseOrderService.getPOs(
        {
          ...filters,
          deliveryStatus: statusFilter,
        },
        pagination.current,
        pagination.pageSize
      );

      // Lọc Client-side bổ sung để chắc chắn (Do API getPOs đang dùng logic OR phức tạp)
      let filtered = resData;
      if (activeTab === "pending") {
        filtered = resData.filter((o: any) =>
          ["pending", "partial"].includes(o.delivery_status)
        );
      } else {
        filtered = resData.filter(
          (o: any) => o.delivery_status === "delivered"
        );
      }

      setData(filtered);
      // Lưu ý: Total có thể bị lệch nếu filter client, tốt nhất là API filter chuẩn.
      // Tạm thời chấp nhận hiển thị total của API trả về.
      setPagination((prev) => ({ ...prev, total: totalCount }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Mã Đơn",
      dataIndex: "code",
      width: 140,
      render: (text: string) => (
        <Tag color="blue" style={{ fontWeight: "bold" }}>
          {text}
        </Tag>
      ),
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name",
      ellipsis: true,
    },
    {
      title: "Ngày Đặt",
      dataIndex: "created_at",
      width: 120,
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Vận chuyển",
      key: "logistics",
      width: 160,
      render: (_: any, record: any) => {
        const methodKey = record.delivery_method || "Unknown";
        const info = logisticsMap[methodKey] || logisticsMap["Unknown"];
        return (
          <Space>
            <Tag icon={info.icon} color={info.color}>
              {info.text}
            </Tag>
            {/* Ẩn số kiện nếu đã xong để đỡ rối */}
            {activeTab === "pending" && (
              <Badge
                count={record.total_cartons}
                overflowCount={99}
                style={{ backgroundColor: "#f0f2f5", color: "#666" }}
              />
            )}
          </Space>
        );
      },
    },
    {
      title: "Tiến độ",
      dataIndex: "progress_delivery",
      width: 150,
      render: (val: number, record: any) => (
        <div style={{ width: 120 }}>
          <div
            style={{
              fontSize: 11,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              {record.delivery_status === "delivered" ? "Hoàn tất" : "Đã nhập"}:
            </span>
            <strong>{val}%</strong>
          </div>
          <div
            style={{
              height: 6,
              background: "#f0f0f0",
              borderRadius: 3,
              marginTop: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${val}%`,
                background: val === 100 ? "#52c41a" : "#1890ff",
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Hành động",
      width: 100,
      fixed: "right" as const,
      align: "center" as const,
      render: (_: any, record: any) => (
        <Tooltip
          title={
            activeTab === "pending"
              ? "Tiến hành Nhập kho"
              : "Xem lại phiếu nhập"
          }
        >
          <Button
            type={activeTab === "pending" ? "primary" : "default"}
            icon={
              activeTab === "pending" ? (
                <DownloadOutlined />
              ) : (
                <HistoryOutlined />
              )
            }
            onClick={() => navigate(`/inventory/receipt/${record.id}`)}
          >
            {activeTab === "pending" ? "Nhập Kho" : "Xem lại"}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content style={{ padding: 24, width: "100%" }}>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0 }}>
              <CodeSandboxOutlined /> Quản lý Nhập Kho (Inbound)
            </Title>
            <Text type="secondary">Tiếp nhận và kiểm đếm hàng hóa về kho</Text>
          </Space>
          <Card
            size="small"
            bodyStyle={{ padding: "8px 16px" }}
            bordered={false}
          >
            <Statistic
              title="Đơn chờ xử lý"
              value={data.length}
              valueStyle={{ color: "#faad14", fontWeight: "bold" }}
              prefix={<TruckOutlined />}
            />
          </Card>
        </div>

        <Card bodyStyle={{ padding: 0 }}>
          {/* TABS ĐIỀU HƯỚNG */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            tabBarStyle={{
              margin: 0,
              padding: "8px 16px 0",
              background: "#fafafa",
            }}
            items={[
              {
                key: "pending",
                label: (
                  <span>
                    <ClockCircleOutlined /> Đang chờ nhập
                  </span>
                ),
              },
              {
                key: "history",
                label: (
                  <span>
                    <CheckCircleOutlined /> Lịch sử đã nhập
                  </span>
                ),
              },
            ]}
          />

          <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
            <Row gutter={16}>
              <Col span={8}>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm mã đơn, NCC..."
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                />
              </Col>
              <Col span={6}>
                <RangePicker
                  placeholder={["Ngày đặt từ", "đến"]}
                  style={{ width: "100%" }}
                  onChange={(dates) =>
                    setFilters({
                      ...filters,
                      dateFrom: dates?.[0]?.toISOString(),
                      dateTo: dates?.[1]?.toISOString(),
                    })
                  }
                />
              </Col>
              <Col span={10} style={{ textAlign: "right" }}>
                <Button icon={<SyncOutlined />} onClick={fetchData}>
                  Làm mới
                </Button>
              </Col>
            </Row>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              onChange: (p, ps) =>
                setPagination({ ...pagination, current: p, pageSize: ps }),
            }}
            scroll={{ x: "max-content" }}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default WarehouseInboundPage;
