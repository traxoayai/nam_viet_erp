// src/features/inventory/pages/InventoryCheckList.tsx
import { PlusOutlined, AuditOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Layout,
  Table,
  Button,
  Tag,
  Typography,
  Select,
  Input,
  DatePicker,
  Card,
  Row,
  Col,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { inventoryService } from "../api/inventoryService";
import { CreateCheckModal } from "../components/CreateCheckModal";

import { posService } from "@/features/pos/api/posService";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const InventoryCheckList = () => {
  const navigate = useNavigate();

  // --- STATE DỮ LIỆU ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // --- STATE BỘ LỌC & PHÂN TRANG ---
  const [filters, setFilters] = useState({
    warehouseId: null as number | null,
    search: "",
    status: null as string | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateRange: null as any,
  });

  // [NEW] State phân trang
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 1. Init: Load danh sách kho
  useEffect(() => {
    posService.getActiveWarehouses().then((whs) => {
      setWarehouses(whs);
      if (whs.length > 0) {
        setFilters((prev) => ({ ...prev, warehouseId: whs[0].id }));
      }
    });
  }, []);

  // 2. Fetch Data khi Filter hoặc Pagination thay đổi
  useEffect(() => {
    if (filters.warehouseId !== null) {
      fetchData();
    }
  }, [
    filters.warehouseId,
    filters.status,
    filters.dateRange,
    pagination.current,
    pagination.pageSize,
  ]);
  // Lưu ý: filters.search nên xử lý riêng (onPressEnter hoặc nút Tìm) để tránh gọi API liên tục

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getCheckSessions({
        warehouseId: filters.warehouseId,
        search: filters.search,
        status: filters.status as any,
        startDate: filters.dateRange
          ? filters.dateRange[0].toISOString()
          : undefined,
        endDate: filters.dateRange
          ? filters.dateRange[1].toISOString()
          : undefined,

        // [NEW] Truyền tham số phân trang
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      // Nếu có dữ liệu, lấy total_count từ bản ghi đầu tiên (do RPC trả về trong từng dòng)
      const totalCount = res.length > 0 ? res[0].total_count : 0;

      setData(res);
      setPagination((prev) => ({
        ...prev,
        total: Number(totalCount), // Cập nhật tổng số dòng
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý khi bấm nút Lọc/Tìm kiếm -> Reset về trang 1
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchData();
  };

  // Xử lý khi đổi trang trên Table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTableChange = (newPagination: any) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  // Columns
  const columns = [
    // ... (Giữ nguyên các cột Mã, Ngày tạo, Người tạo...)
    {
      title: "Mã Phiếu",
      dataIndex: "code",
      key: "code",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (text: string, record: any) => (
        <a
          onClick={() => navigate(`/inventory/stocktake/${record.id}`)}
          style={{ fontWeight: "bold", color: "#1890ff" }}
        >
          {text}
        </a>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => (
        <span style={{ fontSize: 13 }}>
          {dayjs(d).format("DD/MM/YYYY HH:mm")}
        </span>
      ),
    },
    {
      title: "Người tạo",
      dataIndex: "created_by_name",
      key: "creator",
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: "Người kiểm",
      dataIndex: "verified_by_name",
      key: "verifier",
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {text || "-"}
        </Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      align: "center" as const,
      render: (status: string) => {
        let color = "default";
        let text = status;
        if (status === "DRAFT") {
          color = "processing";
          text = "Đang kiểm";
        }
        if (status === "COMPLETED") {
          color = "success";
          text = "Đã hoàn tất";
        }
        if (status === "CANCELLED") {
          color = "error";
          text = "Đã hủy";
        }
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "Chênh lệch",
      dataIndex: "total_diff_value",
      key: "diff",
      align: "right" as const,
      render: (val: number) => (
        <Text
          type={val < 0 ? "danger" : val > 0 ? "success" : "secondary"}
          strong
        >
          {val > 0 ? "+" : ""}
          {val?.toLocaleString()}
        </Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 80,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (_: any, record: any) => (
        <Button
          size="small"
          icon={<AuditOutlined />}
          onClick={() => navigate(`/inventory/stocktake/${record.id}`)}
        />
      ),
    },
  ];

  return (
    <Layout
      style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}
    >
      {/* Header giữ nguyên */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Lịch Sử Kiểm Kê
          </Title>
          <Text type="secondary">
            Theo dõi các đợt kiểm kho và xử lý chênh lệch
          </Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Tạo Phiếu Mới
        </Button>
      </div>

      {/* Filter Bar */}
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ marginBottom: 16, borderRadius: 8 }}
      >
        <Row gutter={[16, 16]} align="middle">
          {/* Chọn Kho */}
          <Col xs={24} sm={12} md={6} lg={5}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Kho kiểm kê:
            </div>
            <Select
              style={{ width: "100%" }}
              value={filters.warehouseId}
              onChange={(val) => {
                setFilters({ ...filters, warehouseId: val });
                setPagination((prev) => ({ ...prev, current: 1 })); // Reset trang
              }}
              options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
              placeholder="Chọn kho..."
            />
          </Col>

          {/* Tìm kiếm */}
          <Col xs={24} sm={12} md={6} lg={6}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Tìm kiếm:
            </div>
            <Input
              placeholder="Mã phiếu, người tạo, người kiểm..."
              prefix={<SearchOutlined style={{ color: "#ccc" }} />}
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          {/* Trạng thái & Ngày - Giữ nguyên logic */}
          <Col xs={12} sm={8} md={4} lg={4}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Trạng thái:
            </div>
            <Select
              style={{ width: "100%" }}
              allowClear
              placeholder="Tất cả"
              value={filters.status}
              onChange={(val) => {
                setFilters({ ...filters, status: val });
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
            >
              <Select.Option value="DRAFT">Đang kiểm</Select.Option>
              <Select.Option value="COMPLETED">Đã hoàn tất</Select.Option>
              <Select.Option value="CANCELLED">Đã hủy</Select.Option>
            </Select>
          </Col>

          <Col xs={12} sm={16} md={6} lg={6}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Thời gian:
            </div>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              onChange={(dates) => {
                setFilters({ ...filters, dateRange: dates });
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
            />
          </Col>

          <Col
            xs={24}
            sm={24}
            md={2}
            lg={3}
            style={{ display: "flex", alignItems: "end" }}
          >
            <Button
              type="primary"
              ghost
              icon={<SearchOutlined />}
              onClick={handleSearch}
              block
            >
              Lọc
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table với Pagination */}
      <Content>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          // [NEW] Cấu hình phân trang
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} phiếu`,
          }}
          onChange={handleTableChange} // Hứng sự kiện đổi trang
          style={{
            background: "#fff",
            borderRadius: 8,
            padding: 0,
            overflow: "hidden",
          }}
        />
      </Content>

      <CreateCheckModal
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
      />
    </Layout>
  );
};

export default InventoryCheckList;
