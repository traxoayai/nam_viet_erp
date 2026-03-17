import { PlusOutlined, AuditOutlined, ShopOutlined } from "@ant-design/icons";
import {
  Button,
  Tag,
  Typography,
  DatePicker,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { inventoryService } from "../api/inventoryService";
import { CreateCheckModal } from "../components/CreateCheckModal";

import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { posService } from "@/features/pos/api/posService";

const { Text } = Typography;
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
      title: "Kho kiểm",
      dataIndex: "warehouse_name",
      key: "warehouse_name",
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

  const statItems = [
    {
      title: "Tổng số phiếu",
      value: pagination.total.toString(),
      color: "#1890ff",
      icon: <AuditOutlined />,
    },
    {
      title: "Kho đang kiểm",
      value: warehouses.find((w) => w.id === filters.warehouseId)?.name || "Chưa chọn kho",
      color: "#faad14",
      icon: <ShopOutlined />,
    },
  ];

  return (
    <div style={{ padding: 8, background: "#e1e1dfff", minHeight: "100vh" }}>
      <StatHeader items={statItems} loading={loading} />

      <FilterAction
        searchPlaceholder="Mã phiếu, người tạo..."
        initialSearch={filters.search}
        onSearch={(val) => {
          setFilters((prev) => ({ ...prev, search: val }));
          setPagination((prev) => ({ ...prev, current: 1 }));
        }}
        filterValues={filters}
        onFilterChange={(key, val) => {
          setFilters((prev) => ({ ...prev, [key]: val }));
          setPagination((prev) => ({ ...prev, current: 1 }));
        }}
        filters={[
          {
            key: "warehouseId",
            placeholder: "Kho kiểm kê",
            options: warehouses.map((w) => ({ label: w.name, value: w.id })),
          },
          {
            key: "status",
            placeholder: "Trạng thái",
            options: [
              { label: "Đang kiểm", value: "DRAFT" },
              { label: "Đã hoàn tất", value: "COMPLETED" },
              { label: "Đã hủy", value: "CANCELLED" },
            ],
          },
        ]}
        actions={[
          {
            render: (
              <RangePicker
                format="DD/MM/YYYY"
                onChange={(dates) => {
                  setFilters((prev) => ({ ...prev, dateRange: dates }));
                  setPagination((prev) => ({ ...prev, current: 1 }));
                }}
              />
            ),
          },
          {
            label: "Tạo Phiếu Mới",
            icon: <PlusOutlined />,
            onClick: () => setIsCreateModalOpen(true),
            type: "primary",
          },
        ]}
        onRefresh={fetchData}
      />

      <SmartTable
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} phiếu`,
        }}
        onChange={handleTableChange}
        emptyText="Chưa có phiếu kiểm kê nào"
      />

      <CreateCheckModal
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
};

export default InventoryCheckList;
