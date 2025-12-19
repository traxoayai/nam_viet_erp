// src/pages/settings/BankListPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  ConfigProvider,
  Select,
  Row,
  Col,
  Space,
  Tag,
  Modal,
  Form,
  App as AntApp,
  Tooltip,
  Popconfirm,
  Avatar,
  Image,
  Switch,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react";

import type { TableProps } from "antd";

// --- NÂNG CẤP V400: Import "bộ não" ---
import { useBankStore } from "@/features/finance/stores/useBankStore";
import { BankRecord } from "@/features/finance/types/bank";

const { Title, Text } = Typography;
const { Option } = Select;

// --- CÁC ĐỊNH NGHĨA (Maps) ---
const statusMap = {
  active: { text: "Sử dụng", color: "success" },
  hidden: { text: "Đã ẩn", color: "default" },
};

// --- COMPONENT CHÍNH ---
const BankListPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();
  const [filterStatus, setFilterStatus] = useState<string | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  // --- NÂNG CẤP V400: Lấy dữ liệu từ "bộ não" ---
  const {
    banks,
    loading,
    isModalVisible,
    editingRecord,
    fetchBanks,
    syncFromVietQR,
    showAddModal,
    showEditModal,
    closeModal,
    addBank,
    updateBank,
    deleteBank,
  } = useBankStore();

  // Tải dữ liệu lần đầu
  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // --- HÀM XỬ LÝ (Handlers) ---
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      // Chuyển đổi giá trị status từ boolean (của Switch) sang string
      const statusValue = values.status ? "active" : "hidden";
      const recordToSave = {
        ...values,
        status: statusValue,
        // Đảm bảo các trường không có trong form được gán giá trị mặc định
        transfer_supported: editingRecord?.transfer_supported || false,
        lookup_supported: editingRecord?.lookup_supported || false,
      };

      let success = false;
      if (editingRecord) {
        // Logic Sửa
        success = await updateBank(editingRecord.id, recordToSave);
        if (success)
          antMessage.success(`Cập nhật ngân hàng "${values.name}" thành công!`);
      } else {
        // Logic Thêm
        success = await addBank(recordToSave);
        if (success)
          antMessage.success(`Thêm mới ngân hàng "${values.name}" thành công!`);
      }

      if (success) {
        closeModal();
      } else {
        antMessage.error(
          "Thao tác thất bại. Mã BIN hoặc Mã Code có thể đã tồn tại."
        );
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const handleDelete = async (record: BankRecord) => {
    const success = await deleteBank(record.id);
    if (success) {
      antMessage.success(`Đã xóa ngân hàng "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại.");
    }
  };

  const handleSync = async () => {
    antMessage.loading({ content: "Đang đồng bộ với VietQR...", key: "sync" });
    try {
      const count = await syncFromVietQR();
      antMessage.success({
        content: `Đồng bộ ${count} ngân hàng thành công!`,
        key: "sync",
        duration: 2,
      });
    } catch (error: any) {
      antMessage.error({
        content: `Đồng bộ thất bại: ${error.message}`,
        key: "sync",
      });
    }
  };

  // Lọc dữ liệu hiển thị (Client-side)
  const filteredBanks = banks.filter((bank) => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      !searchQuery ||
      bank.name.toLowerCase().includes(searchLower) ||
      bank.short_name.toLowerCase().includes(searchLower) ||
      bank.bin.includes(searchLower) ||
      bank.code.toLowerCase().includes(searchLower);

    const matchStatus = !filterStatus || bank.status === filterStatus;

    return matchSearch && matchStatus;
  });

  // --- ĐỊNH NGHĨA CỘT (Columns) ---
  const columns: TableProps<BankRecord>["columns"] = [
    {
      title: "Logo",
      dataIndex: "logo",
      key: "logo",
      width: 80,
      align: "center",
      render: (logo) => (
        <Avatar
          src={
            <Image
              src={logo}
              preview={false}
              fallback="https://placehold.co/32x32/f0f0f0/d9d9d9?text=N/A"
            />
          }
          shape="circle"
          size="small"
        />
      ),
    },
    {
      title: "Tên Viết Tắt (ShortName)",
      dataIndex: "short_name",
      key: "short_name",
      width: 150,
      render: (text) => <Text strong>{text}</Text>,
      sorter: (a, b) => a.short_name.localeCompare(b.short_name),
    },
    {
      title: "Tên Đầy Đủ Ngân hàng",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Mã BIN (VietQR)",
      dataIndex: "bin",
      key: "bin",
      width: 150,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Mã Code (Napas)",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (text) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center",
      render: (status: "active" | "hidden") => {
        const statusInfo = statusMap[status] || statusMap.hidden;
        return (
          <Tag color={statusInfo.color} style={{ margin: 0 }}>
            {statusInfo.text}
          </Tag>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 120,
      align: "center",
      fixed: "right",
      render: (_, record: BankRecord) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  ...record,
                  status: record.status === "active",
                });
                showEditModal(record);
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Sếp chắc chắn muốn xóa?"
              description={`Xóa ngân hàng "${record.name}"?`}
              onConfirm={() => handleDelete(record)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // --- GIAO DIỆN (JSX) ---
  return (
    <ConfigProvider locale={viVN}>
      <Card
        variant="outlined" // <-- TỐI ƯU UI: Border đậm
        styles={{ body: { padding: 12 } }} // <-- TỐI ƯU UI: Padding nhỏ
      >
        <Spin spinning={loading} tip="Đang tải...">
          {/* Phần 1: Header */}
          <Row
            justify="space-between"
            align="middle"
            style={{ marginBottom: 16 }}
          >
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                Danh mục Ngân hàng (VietQR)
              </Title>
              <Text type="secondary">
                Quản lý danh sách ngân hàng để tạo QR thanh toán.
              </Text>
            </Col>
            <Col>
              <Space>
                <Button icon={<SyncOutlined />} onClick={handleSync}>
                  Đồng bộ từ VietQR
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    form.setFieldsValue({ status: true });
                    showAddModal();
                  }}
                >
                  Thêm Ngân hàng
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Phần 2: Bộ lọc */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col flex="auto">
              <Input
                prefix={<SearchOutlined />}
                placeholder="Tìm theo Tên, Tên viết tắt, Mã BIN, Mã Code..."
                allowClear
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Col>
            <Col flex="200px">
              <Select
                placeholder="Lọc theo trạng thái"
                allowClear
                style={{ width: "100%" }}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
              >
                <Option value="active">Đang sử dụng</Option>
                <Option value="hidden">Đã ẩn</Option>
              </Select>
            </Col>
          </Row>

          {/* Phần 3: Bảng dữ liệu */}
          <Table
            columns={columns}
            dataSource={filteredBanks} // Dùng data đã lọc
            bordered // <-- TỐI ƯU UI
            rowKey="key"
            pagination={{
              pageSize: 10,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} của ${total} ngân hàng`,
            }}
            scroll={{ x: 1000 }}
          />
        </Spin>
      </Card>

      {/* Modal Thêm/Sửa */}
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {editingRecord ? `Sửa Thông tin Ngân hàng` : "Thêm Ngân hàng mới"}
          </Title>
        }
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={closeModal}
        okText={editingRecord ? "Lưu Cập nhật" : "Tạo mới"}
        cancelText="Hủy"
        width={700}
        destroyOnHidden
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="short_name"
                label="Tên Viết Tắt (ShortName)"
                rules={[
                  { required: true, message: "Vui lòng nhập tên viết tắt!" },
                ]}
              >
                <Input placeholder="Vd: Vietcombank" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên Đầy Đủ Ngân hàng"
                rules={[
                  { required: true, message: "Vui lòng nhập tên đầy đủ!" },
                ]}
              >
                <Input placeholder="Vd: Ngân hàng TMCP Ngoại Thương Việt Nam" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="bin"
                label="Mã BIN (VietQR)"
                rules={[{ required: true, message: "Vui lòng nhập Mã BIN!" }]}
                tooltip="Mã này dùng để tạo QR Code (theo file PDF Sếp gửi)"
              >
                <Input placeholder="Vd: 970436" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã Code (Napas)"
                rules={[{ required: true, message: "Vui lòng nhập Mã Code!" }]}
                tooltip="Mã này cũng có thể dùng để tạo QR Code (theo file PDF Sếp gửi)"
              >
                <Input placeholder="Vd: VCB" />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item
                name="logo"
                label="Logo URL"
                tooltip="Link ảnh logo của ngân hàng"
              >
                <Input placeholder="Vd: https://api.vietqr.io/img/VCB.png" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="status"
                label="Trạng thái"
                valuePropName="checked" // <-- Rất quan trọng cho Switch
                tooltip="Bỏ chọn nếu Sếp muốn ẩn ngân hàng này khỏi các dropdown."
              >
                <Switch checkedChildren="Sử dụng" unCheckedChildren="Ẩn" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </ConfigProvider>
  );
};

export default BankListPage;
