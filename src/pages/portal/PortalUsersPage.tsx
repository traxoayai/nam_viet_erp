import { Users, Plus, Clock } from "lucide-react";
import { UserOutlined } from "@ant-design/icons";
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  App as AntApp,
  Empty,
  Input,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";

import {
  fetchPortalUsers,
  togglePortalUserStatus,
  type PortalUserRow,
} from "@/features/sales/api/portalUserService";
import CreatePortalUserModal from "./CreatePortalUserModal";

const { Content } = Layout;
const { Title, Text } = Typography;

const PortalUsersPage: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(
    async (searchValue?: string) => {
      setLoading(true);
      try {
        const users = await fetchPortalUsers(searchValue ?? search);
        setData(users);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        antMessage.error(`Lỗi tải dữ liệu: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [search, antMessage],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (value: string) => {
    setSearch(value);
    loadData(value);
  };

  const handleToggleStatus = async (record: PortalUserRow) => {
    const newStatus = record.status === "active" ? "inactive" : "active";
    setTogglingId(record.id);
    try {
      await togglePortalUserStatus(record.id, newStatus);
      antMessage.success(
        newStatus === "active"
          ? `Đã kích hoạt ${record.display_name ?? record.email}`
          : `Đã vô hiệu hóa ${record.display_name ?? record.email}`,
      );
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      antMessage.error(`Lỗi: ${msg}`);
    } finally {
      setTogglingId(null);
    }
  };

  const columns: ColumnsType<PortalUserRow> = [
    {
      title: "Tên hiển thị",
      key: "display_name",
      render: (_: unknown, record: PortalUserRow) => (
        <Space>
          <UserOutlined />
          <Text strong>{record.display_name || record.email}</Text>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 220,
    },
    {
      title: "Khách hàng B2B",
      key: "customer",
      width: 220,
      render: (_: unknown, record: PortalUserRow) => (
        <Space direction="vertical" size={0}>
          <Text>{record.customer_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.customer_code}
          </Text>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 100,
      render: (role: string) => (
        <Tag color={role === "owner" ? "blue" : "default"}>
          {role}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) =>
        status === "active" ? (
          <Tag color="green">Hoạt động</Tag>
        ) : (
          <Tag color="red">Vô hiệu</Tag>
        ),
    },
    {
      title: "Login cuối",
      dataIndex: "last_login_at",
      key: "last_login_at",
      width: 170,
      render: (date: string | null) =>
        date ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Clock size={14} />
            {dayjs(date).format("DD/MM/YYYY HH:mm")}
          </div>
        ) : (
          <Text type="secondary" italic>
            Chưa login
          </Text>
        ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Hành động",
      key: "action",
      width: 130,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: unknown, record: PortalUserRow) => {
        const isActive = record.status === "active";
        return (
          <Button
            size="small"
            danger={isActive}
            loading={togglingId === record.id}
            onClick={() => handleToggleStatus(record)}
          >
            {isActive ? "Vô hiệu hóa" : "Kích hoạt"}
          </Button>
        );
      },
    },
  ];

  return (
    <Content className="p-4 sm:p-6 bg-[#f8fafc]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Title level={3} className="m-0 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Users className="text-purple-600" size={22} />
            </div>
            Quản lý Portal Users
          </Title>
          <Text type="secondary">
            Quản lý tài khoản người dùng B2B Portal
          </Text>
        </div>
        <Space>
          <Input.Search
            placeholder="Tìm theo tên, email, mã KH..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 280 }}
          />
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Tạo Portal User
          </Button>
        </Space>
      </div>

      <Card
        className="shadow-sm border-0 overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 15 }}
          locale={{
            emptyText: (
              <Empty description="Không có portal user nào" />
            ),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <CreatePortalUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          loadData();
        }}
      />
    </Content>
  );
};

export default PortalUsersPage;
