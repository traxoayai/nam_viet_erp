// src/pages/finance/FinanceTransactionPage.tsx
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WalletOutlined,
  //   FilterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  EyeOutlined,
  AuditOutlined,
  DeleteOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Space,
  Popconfirm,
  Tooltip,
  Input,
  App,
} from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useState } from "react";

import { FinanceFormModal } from "./components/FinanceFormModal";
import { TransactionDetailModal } from "./components/TransactionDetailModal"; // Import Modal mới
import { useFinanceTransactionLogic } from "./hooks/useFinanceTransactionLogic";

import { useFinanceStore } from "@/stores/useFinanceStore";
import { TransactionRecord } from "@/types/finance";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Content } = Layout;
const { RangePicker } = DatePicker;

const FinanceTransactionPage = () => {
  const logic = useFinanceTransactionLogic();
  const { confirmTransaction, exportExcel, deleteTransaction } =
    useFinanceStore();
  const { message } = App.useApp();
  const [viewRecord, setViewRecord] = useState<TransactionRecord | null>(null);

  // Chỉ xóa phiếu Pending
  const canDelete = (record: TransactionRecord) => record.status === "pending";

  const handleDelete = async (id: number) => {
    const success = await deleteTransaction(id);
    if (success) message.success("Đã xóa phiếu");
  };

  const columns = [
    {
      title: "Mã Phiếu",
      dataIndex: "code",
      width: 160,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: "Ngày tạo", // Đổi tên cho rõ nghĩa
      dataIndex: "transaction_date",
      width: 150, // Tăng độ rộng một chút
      // AURA FIX: Format hiển thị Giờ trước, Ngày sau để dễ nhìn
      render: (date: string) => {
        if (!date) return "--";
        const vnTime = dayjs(date).tz("Asia/Ho_Chi_Minh");
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontWeight: 500 }}>{vnTime.format("HH:mm")}</span>
            <span style={{ fontSize: 12, color: "#888" }}>
              {vnTime.format("DD/MM/YYYY")}
            </span>
          </div>
        );
      },
    },
    // --- SỬA LỖI 4: Thêm cột Diễn giải ---
    {
      title: "Nội dung / Diễn giải",
      dataIndex: "description",
      render: (text: string, record: TransactionRecord) => (
        <div style={{ maxWidth: 300 }}>
          <div className="font-medium text-blue-800">{record.partner_name}</div>
          <div
            className="text-xs text-gray-600"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {text}
          </div>
          <Tag style={{ marginTop: 4 }}>{record.business_type}</Tag>
        </div>
      ),
    },
    {
      title: "Số tiền",
      key: "amount",
      align: "right" as const,
      width: 150,
      render: (_: any, record: TransactionRecord) => (
        <span
          style={{
            color: record.flow === "in" ? "#52c41a" : "#f5222d",
            fontWeight: "bold",
            fontSize: 15,
          }}
        >
          {record.flow === "in" ? "+" : "-"}
          {Number(record.amount).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      width: 130,
      render: (status: string) => {
        if (status === "completed")
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Hoàn tất
            </Tag>
          );
        if (status === "approved")
          return (
            <Tag icon={<AuditOutlined />} color="processing">
              Đã duyệt chi
            </Tag>
          ); // Màu xanh dương
        if (status === "cancelled")
          return (
            <Tag icon={<StopOutlined />} color="error">
              Đã hủy
            </Tag>
          );

        return (
          <Tag icon={<ClockCircleOutlined />} color="warning">
            Mới tạo
          </Tag>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 160, // Tăng độ rộng một chút
      fixed: "right" as const,
      align: "center" as const,
      render: (_: any, record: TransactionRecord) => (
        <Space size="small">
          {/* --- LOGIC NÚT DUYỆT THÔNG MINH --- */}

          {/* TRƯỜNG HỢP 1: PHIẾU THU (Mới -> Đã Thu) */}
          {record.flow === "in" && record.status === "pending" && (
            <Tooltip title="Xác nhận đã nhận tiền">
              <Popconfirm
                title="Xác nhận ĐÃ THU tiền?"
                description="Số dư quỹ sẽ tăng ngay lập tức."
                onConfirm={() => confirmTransaction(record.id, "completed")}
                okText="Đã Thu"
                okType="primary"
              >
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckCircleOutlined />}
                >
                  Đã Thu
                </Button>
              </Popconfirm>
            </Tooltip>
          )}

          {/* TRƯỜNG HỢP 2: PHIẾU CHI (Mới -> Duyệt Chi) */}
          {record.flow === "out" && record.status === "pending" && (
            <Tooltip title="Quản lý duyệt chi">
              <Popconfirm
                title="Duyệt khoản chi này?"
                description="Chưa trừ tiền quỹ. Chỉ đánh dấu là được phép chi."
                onConfirm={() => confirmTransaction(record.id, "approved")}
                okText="Duyệt"
              >
                <Button
                  size="small"
                  type="default"
                  icon={<AuditOutlined />}
                  style={{ borderColor: "#faad14", color: "#faad14" }}
                >
                  Duyệt
                </Button>
              </Popconfirm>
            </Tooltip>
          )}

          {/* TRƯỜNG HỢP 3: PHIẾU CHI (Đã Duyệt -> Đã Chi) */}
          {record.flow === "out" && record.status === "approved" && (
            <Tooltip title="Thủ quỹ xác nhận xuất tiền">
              <Popconfirm
                title="Xác nhận ĐÃ CHI tiền?"
                description="Tiền sẽ bị trừ khỏi Sổ Quỹ."
                onConfirm={() => confirmTransaction(record.id, "completed")}
                okText="Đã Chi"
                okType="primary"
              >
                <Button
                  size="small"
                  type="primary"
                  danger
                  ghost
                  icon={<WalletOutlined />}
                >
                  Xuất Tiền
                </Button>
              </Popconfirm>
            </Tooltip>
          )}

          <Tooltip title="Xem chi tiết">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setViewRecord(record)}
            />
          </Tooltip>

          {canDelete(record) && (
            <Tooltip title="Hủy phiếu">
              <Popconfirm
                title="Hủy phiếu này?"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content style={{ padding: 0 }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic
                title="Tổng Quỹ Thực Tế (Tất cả các quỹ)"
                value={logic.totalBalance}
                precision={0}
                valueStyle={{ color: "#1890ff" }}
                prefix={<WalletOutlined />}
                suffix="đ"
              />
            </Card>
          </Col>
        </Row>

        <Card bordered={false}>
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <Space wrap style={{ flex: 1 }}>
              {/* --- SỬA LỖI 5: Mở rộng ô tìm kiếm --- */}
              <Input.Search
                placeholder="Tìm mã, tên, nội dung..."
                style={{ width: 300 }} // Tăng width
                allowClear
                onSearch={(val) => logic.setFilters({ search: val })}
                enterButton
              />
              <Select
                placeholder="Trạng thái"
                allowClear
                style={{ width: 140 }}
                onChange={(val) => logic.setFilters({ status: val })}
              >
                <Select.Option value="pending">Chờ duyệt</Select.Option>
                <Select.Option value="confirmed">Đã duyệt</Select.Option>
                <Select.Option value="completed">Đã hoàn tất</Select.Option>
                <Select.Option value="cancelled">Đã hủy</Select.Option>
              </Select>
              <RangePicker
                style={{ width: 240 }}
                placeholder={["Từ ngày", "Đến ngày"]}
                onChange={(dates) =>
                  logic.setFilters({
                    date_from: dates?.[0]?.toISOString(),
                    date_to: dates?.[1]?.toISOString(),
                  })
                }
              />
            </Space>

            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={exportExcel}>
                Xuất Excel
              </Button>
              <Button
                type="primary"
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                icon={<ArrowUpOutlined />}
                onClick={() => logic.openCreateModal("in")}
              >
                Lập Phiếu Thu
              </Button>
              <Button
                type="primary"
                danger
                icon={<ArrowDownOutlined />}
                onClick={() => logic.openCreateModal("out")}
              >
                Lập Phiếu Chi
              </Button>
            </Space>
          </div>

          <Table
            dataSource={logic.transactions}
            columns={columns}
            rowKey="id"
            loading={logic.loading}
            pagination={{
              current: logic.page,
              pageSize: logic.pageSize,
              total: logic.totalCount,
              onChange: logic.setPage,
              showSizeChanger: true,
            }}
            scroll={{ x: 1000 }}
          />
        </Card>

        <FinanceFormModal
          open={logic.isModalOpen}
          onCancel={() => logic.setIsModalOpen(false)}
          initialFlow={logic.modalFlow}
        />
        <TransactionDetailModal
          open={!!viewRecord}
          data={viewRecord}
          onCancel={() => setViewRecord(null)}
        />
      </Content>
    </Layout>
  );
};

export default FinanceTransactionPage;
