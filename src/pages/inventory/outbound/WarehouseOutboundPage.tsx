import {
  Package,
  Truck,
  CheckCircle,
  Search,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  Badge,
  Card,
  Col,
  Grid,
  Input,
  List,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Button
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { outboundService } from "@/features/inventory/api/outboundService";
import { OutboundStats, OutboundTask } from "@/features/inventory/types/outbound";
import { WarehouseToolBar } from "@/shared/ui/warehouse-tools";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const WarehouseOutboundPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  
  const [tasks, setTasks] = useState<OutboundTask[]>([]);
  const [stats, setStats] = useState<OutboundStats>({
    pending_packing: 0,
    shipping: 0,
    completed_today: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const WAREHOUSE_ID = 1; 

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (search?: string) => {
    setLoading(true);
    try {
      const [dataTasks, dataStats] = await Promise.all([
        outboundService.getOutboundTasks(WAREHOUSE_ID, search),
        outboundService.getOutboundStats(WAREHOUSE_ID),
      ]);
      setTasks(dataTasks);
      setStats(dataStats);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val: string) => {
    setSearchText(val);
    fetchData(val);
  };

  // --- HANDLER SMART TOOLS ---
  const handleScan = (code: string) => {
    // 1. Tìm xem code có trong list danh sách không
    const task = tasks.find((t) => t.code === code);
    if (task) {
      // Navigate thẳng chi tiết
      navigate(`/inventory/outbound/${task.task_id}`);
    } else {
      // Nếu không, tìm kiếm
      handleSearch(code);
    }
  };

  // --- UI COLUMNS (DESKTOP) ---
  const columns = [
    {
      title: "Ưu tiên",
      dataIndex: "priority",
      width: 100,
      render: (val: string) => (
        <Badge
          status={val === "High" ? "error" : "success"}
          text={val === "High" ? "Gấp" : "Thường"}
        />
      ),
    },
    {
      title: "Mã Đơn",
      dataIndex: "code",
      key: "code",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Khách hàng",
      dataIndex: "customer_name",
      key: "customer_name",
    },
    {
      title: "Số lượng",
      dataIndex: "item_count",
      align: "center" as const,
      width: 100,
      render: (val: number) => <Tag>{val} item</Tag>,
    },
    {
      title: "Deadline",
      dataIndex: "delivery_deadline",
      render: (val: string) => (
        <Space>
           <Clock size={14} />
           <span>{new Date(val).toLocaleTimeString()}</span>
        </Space>
      ),
    },
    {
      title: "",
      width: 60,
      render: (_: any, record: OutboundTask) => (
        <Button 
           type="link" 
           icon={<ArrowRight size={16} />} 
           onClick={() => navigate(`/inventory/outbound/${record.task_id}`)}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, paddingBottom: 80, background: "#f5f5f5", minHeight: "100vh" }}>
      <Title level={4}>Xuất kho & Giao hàng</Title>

      {/* 1. STATUS WIDGETS */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8} md={8}>
          <Card bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Chờ đóng gói"
              value={stats.pending_packing}
              valueStyle={{ color: "#faad14" }}
              prefix={<Package size={20} />}
            />
          </Card>
        </Col>
        <Col xs={8} md={8}>
          <Card bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Đang giao"
              value={stats.shipping}
              valueStyle={{ color: "#1890ff" }}
              prefix={<Truck size={20} />}
            />
          </Card>
        </Col>
        <Col xs={8} md={8}>
          <Card bodyStyle={{ padding: 12 }}>
            <Statistic
              title="Hoàn tất"
              value={stats.completed_today}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircle size={20} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. SEARCH BAR */}
      <Input
        size="large"
        placeholder="Tìm mã đơn, khách hàng..."
        prefix={<Search size={18} color="#999" />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onPressEnter={() => handleSearch(searchText)}
        style={{ marginBottom: 16 }}
      />

      {/* 3. TASK LIST (Smart Switching) */}
      <Card bodyStyle={{ padding: 0 }} loading={loading}>
        {screens.md ? (
          <Table
            dataSource={tasks}
            columns={columns}
            rowKey="task_id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <List
            dataSource={tasks}
            renderItem={(item) => (
              <div
                onClick={() => navigate(`/inventory/outbound/${item.task_id}`)}
                style={{
                  padding: 16,
                  borderBottom: "1px solid #f0f0f0",
                  background: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 16 }}>
                      {item.code}
                    </Text>
                    {item.priority === "High" && (
                      <Tag color="red" style={{ margin: 0 }}>Gấp</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ display: "block" }}>
                    {item.customer_name} • {item.item_count} items
                  </Text>
                  <Space style={{ marginTop: 4, color: item.priority === "High" ? "red" : "#666" }}>
                     <Clock size={14} />
                     <span style={{ fontSize: 12 }}>Deadline: {new Date(item.delivery_deadline).toLocaleTimeString()}</span>
                  </Space>
                </div>
                <ArrowRight size={20} color="#ccc" />
              </div>
            )}
          />
        )}
      </Card>

      {/* 4. SMART TOOLS BAR */}
      <WarehouseToolBar 
         onScan={handleScan}
         onVoice={(text) => handleSearch(text)}
      />
    </div>
  );
};

export default WarehouseOutboundPage;
