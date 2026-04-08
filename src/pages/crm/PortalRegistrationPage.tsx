import {
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  FileText,
  Clock,
  Users,
} from "lucide-react";
import {
  Layout,
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Space,
  App as AntApp,
  Tooltip,
  Badge,
  Empty,
  Modal,
  Descriptions,
  Tabs,
  Input,
} from "antd";
import React, { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import {
  fetchPortalRegistrations,
  approvePortalRegistration,
  rejectPortalRegistration,
  type PortalRegistrationRequest,
} from "@/features/sales/api/portalRegistrationService";
import ApproveRegistrationModal from "./ApproveRegistrationModal";

const { Content } = Layout;
const { Title, Text } = Typography;

const STATUS_CONFIG = {
  pending: { color: "orange", label: "Chờ duyệt" },
  approved: { color: "green", label: "Đã duyệt" },
  rejected: { color: "red", label: "Đã từ chối" },
} as const;

const PortalRegistrationPage: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalRegistrationRequest[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRequest, setSelectedRequest] =
    useState<PortalRegistrationRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadData = useCallback(
    async (status: string = activeTab) => {
      setLoading(true);
      try {
        const registrations = await fetchPortalRegistrations(status);
        setData(registrations);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        antMessage.error(`Lỗi tải dữ liệu: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, antMessage],
  );

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  const handleApproveConfirm = async (
    existingCustomerId: number | null,
    debtLimit: number,
    paymentTerm: number,
  ) => {
    if (!selectedRequest) return;
    setApproveLoading(true);
    try {
      await approvePortalRegistration(
        selectedRequest.id,
        existingCustomerId,
        debtLimit,
        paymentTerm,
      );
      antMessage.success(
        `Đã phê duyệt thành công cho ${selectedRequest.business_name}`,
      );
      setApproveOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      antMessage.error(`Lỗi phê duyệt: ${msg}`);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;
    setRejectLoading(true);
    try {
      await rejectPortalRegistration(selectedRequest.id, rejectReason);
      antMessage.warning(
        `Đã từ chối yêu cầu của ${selectedRequest.business_name}`,
      );
      setRejectOpen(false);
      setRejectReason("");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      antMessage.error(`Lỗi: ${msg}`);
    } finally {
      setRejectLoading(false);
    }
  };

  const openApprove = (r: PortalRegistrationRequest) => {
    setSelectedRequest(r);
    setApproveOpen(true);
  };

  const openReject = (r: PortalRegistrationRequest) => {
    setSelectedRequest(r);
    setRejectReason("");
    setRejectOpen(true);
  };

  const showDetails = (r: PortalRegistrationRequest) => {
    setSelectedRequest(r);
    setDetailOpen(true);
  };

  const isPending = activeTab === "pending";

  const columns = [
    {
      title: "Khách hàng / Doanh nghiệp",
      key: "business",
      render: (_: unknown, record: PortalRegistrationRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: "15px" }}>
            {record.business_name}
          </Text>
          <Space
            split={<div className="h-3 w-[1px] bg-gray-300 mx-1" />}
          >
            <Text
              type="secondary"
              className="flex items-center gap-1 text-xs"
            >
              <Mail size={12} /> {record.email}
            </Text>
            <Text
              type="secondary"
              className="flex items-center gap-1 text-xs"
            >
              <Phone size={12} /> {record.phone}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Mã số thuế",
      dataIndex: "tax_code",
      key: "tax_code",
      width: 150,
      render: (text: string | null) =>
        text || (
          <Text type="secondary" italic>
            Không có
          </Text>
        ),
    },
    {
      title: "Người liên hệ",
      key: "contact",
      width: 200,
      render: (_: unknown, record: PortalRegistrationRequest) => (
        <Space direction="vertical" size={0}>
          <Text>{record.contact_name}</Text>
          {record.contact_phone && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.contact_phone}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: PortalRegistrationRequest["status"]) => {
        const cfg = STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (date: string) => (
        <div className="flex items-center gap-2 text-gray-500">
          <Clock size={14} />
          {dayjs(date).format("DD/MM/YYYY HH:mm")}
        </div>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      width: 140,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: unknown, record: PortalRegistrationRequest) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              icon={<FileText size={18} className="text-blue-500" />}
              onClick={() => showDetails(record)}
            />
          </Tooltip>
          {isPending && (
            <>
              <Tooltip title="Duyệt hồ sơ">
                <Button
                  type="text"
                  icon={
                    <CheckCircle
                      size={20}
                      className="text-green-600"
                    />
                  }
                  onClick={() => openApprove(record)}
                />
              </Tooltip>
              <Tooltip title="Từ chối">
                <Button
                  type="text"
                  danger
                  icon={<XCircle size={20} />}
                  onClick={() => openReject(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Content className="p-4 sm:p-6 bg-[#f8fafc]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="m-0 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Users className="text-blue-600" size={22} />
            </div>
            Phê duyệt đăng ký B2B Portal
          </Title>
          <Text type="secondary">
            Quản lý và xét duyệt yêu cầu mở tài khoản từ Website Portal
          </Text>
        </div>
        <Badge count={data.length} offset={[10, 0]} color="#1677ff">
          <Button type="default" onClick={() => loadData()} loading={loading}>
            Làm mới
          </Button>
        </Badge>
      </div>

      <Card
        className="shadow-sm border-0 overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="px-4 pt-2"
          items={[
            { key: "pending", label: "Chờ duyệt" },
            { key: "approved", label: "Đã duyệt" },
            { key: "rejected", label: "Đã từ chối" },
          ]}
        />
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                description={`Không có yêu cầu nào ${STATUS_CONFIG[activeTab as keyof typeof STATUS_CONFIG]?.label.toLowerCase() ?? ""}`}
              />
            ),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết yêu cầu đăng ký"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          isPending
            ? [
                <Button
                  key="back"
                  onClick={() => setDetailOpen(false)}
                >
                  Đóng
                </Button>,
                <Button
                  key="reject"
                  danger
                  onClick={() => {
                    setDetailOpen(false);
                    openReject(selectedRequest!);
                  }}
                >
                  Từ chối
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  onClick={() => {
                    setDetailOpen(false);
                    openApprove(selectedRequest!);
                  }}
                >
                  Duyệt ngay
                </Button>,
              ]
            : [
                <Button
                  key="back"
                  onClick={() => setDetailOpen(false)}
                >
                  Đóng
                </Button>,
              ]
        }
        width={700}
      >
        {selectedRequest && (
          <Descriptions bordered column={2} className="mt-4">
            <Descriptions.Item label="Doanh nghiệp" span={2}>
              <Text strong className="text-blue-600">
                {selectedRequest.business_name}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Mã số thuế">
              {selectedRequest.tax_code || "N/A"}
            </Descriptions.Item>
            <Descriptions.Item label="SĐT">
              {selectedRequest.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Email" span={2}>
              {selectedRequest.email}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ" span={2}>
              {selectedRequest.address || "N/A"}
            </Descriptions.Item>
            <Descriptions.Item label="Người liên hệ">
              {selectedRequest.contact_name}
            </Descriptions.Item>
            <Descriptions.Item label="SĐT liên hệ">
              {selectedRequest.contact_phone || "N/A"}
            </Descriptions.Item>
            <Descriptions.Item label="Email liên hệ" span={2}>
              {selectedRequest.contact_email || "N/A"}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú khách hàng" span={2}>
              <div className="bg-orange-50 p-3 rounded border border-orange-100 min-h-[80px]">
                {selectedRequest.note || "Không có ghi chú."}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag
                color={
                  STATUS_CONFIG[selectedRequest.status].color
                }
              >
                {STATUS_CONFIG[selectedRequest.status].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian gửi">
              {dayjs(selectedRequest.created_at).format(
                "DD/MM/YYYY HH:mm:ss",
              )}
            </Descriptions.Item>
            {selectedRequest.rejection_reason && (
              <Descriptions.Item label="Lý do từ chối" span={2}>
                <Text type="danger">
                  {selectedRequest.rejection_reason}
                </Text>
              </Descriptions.Item>
            )}
            {selectedRequest.approved_at && (
              <Descriptions.Item label="Ngày duyệt" span={2}>
                {dayjs(selectedRequest.approved_at).format(
                  "DD/MM/YYYY HH:mm:ss",
                )}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Approve Modal */}
      <ApproveRegistrationModal
        open={approveOpen}
        request={selectedRequest}
        loading={approveLoading}
        onConfirm={handleApproveConfirm}
        onCancel={() => setApproveOpen(false)}
      />

      {/* Reject Modal */}
      <Modal
        title="Từ chối đăng ký"
        open={rejectOpen}
        onOk={handleRejectConfirm}
        onCancel={() => setRejectOpen(false)}
        okText="Xác nhận từ chối"
        okType="danger"
        cancelText="Hủy"
        confirmLoading={rejectLoading}
      >
        {selectedRequest && (
          <div className="mb-4">
            <Text>
              Từ chối yêu cầu từ{" "}
              <Text strong>{selectedRequest.business_name}</Text>?
            </Text>
          </div>
        )}
        <Input.TextArea
          rows={4}
          placeholder="Lý do từ chối (không bắt buộc)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </Content>
  );
};

export default PortalRegistrationPage;
