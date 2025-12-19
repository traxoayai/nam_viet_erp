// src/pages/settings/FundAccountPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  App as AntApp,
  Tooltip,
  Popconfirm,
  Radio,
  Spin,
} from "antd";
import React, { useEffect } from "react";

import type { TableProps } from "antd";

// --- NÂNG CẤP V400: Import các "bộ não" ---
import { useBankStore } from "@/features/finance/stores/useBankStore"; // Dùng để lấy danh sách ngân hàng
import { useFundAccountStore } from "@/features/finance/stores/useFundAccountStore";
import { FundAccountRecord } from "@/features/finance/types/fundAccount";

const { Title, Text } = Typography;
const { Option } = Select;

// --- CÁC ĐỊNH NGHĨA (Maps) ---
const accountTypeMap = {
  cash: {
    text: "Tiền mặt",
    color: "success",
    icon: <WalletOutlined />,
  },
  bank: {
    text: "Ngân hàng",
    color: "blue",
    icon: <BankOutlined />,
  },
};
const statusMap = {
  active: { text: "Đang sử dụng", color: "success" },
  locked: { text: "Đã khóa", color: "error" },
};

// --- COMPONENT CHÍNH ---
const FundAccountPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();

  // --- NÂNG CẤP V400: Lấy dữ liệu từ "bộ não" ---
  const {
    fundAccounts,
    loading,
    isModalVisible,
    editingRecord,
    modalAccountType,
    fetchFundAccounts,
    showAddModal,
    showEditModal,
    closeModal,
    setModalAccountType,
    addFundAccount,
    updateFundAccount,
    deleteFundAccount,
  } = useFundAccountStore();

  // Lấy danh sách ngân hàng từ "bộ não" banks
  const { banks, fetchBanks } = useBankStore();

  // Tải dữ liệu lần đầu
  useEffect(() => {
    fetchFundAccounts();
    fetchBanks(); // Tải luôn danh sách ngân hàng
  }, [fetchFundAccounts, fetchBanks]);

  // --- HÀM XỬ LÝ (Handlers) ---
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let success = false;

      if (editingRecord) {
        success = await updateFundAccount(editingRecord.id, values);
        if (success)
          antMessage.success(`Cập nhật tài khoản "${values.name}" thành công!`);
      } else {
        success = await addFundAccount(values);
        if (success)
          antMessage.success(`Thêm mới tài khoản "${values.name}" thành công!`);
      }

      if (success) {
        closeModal();
      } else {
        antMessage.error("Thao tác thất bại. Tên tài khoản có thể đã tồn tại.");
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const handleDelete = async (record: FundAccountRecord) => {
    const success = await deleteFundAccount(record.id);
    if (success) {
      antMessage.success(`Đã xóa tài khoản "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại.");
    }
  };

  // --- ĐỊNH NGHĨA CỘT (Columns) ---
  const columns: TableProps<FundAccountRecord>["columns"] = [
    {
      title: "Tên Tài khoản / Quỹ tiền",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (type: "cash" | "bank") => {
        const typeInfo = accountTypeMap[type];
        return (
          <Tag color={typeInfo.color} icon={typeInfo.icon}>
            {typeInfo.text}
          </Tag>
        );
      },
    },
    {
      title: "Số TK / Địa điểm",
      dataIndex: "account_number",
      key: "location_acc",
      render: (_, record) => record.account_number || record.location || "N/A",
    },
    {
      title: "Tên Ngân hàng",
      dataIndex: "bankName", // Dùng trường "bankName" đã JOIN
      key: "bankName",
      render: (text) => text || "N/A",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      align: "center",
      render: (status: "active" | "locked") => {
        const statusInfo = statusMap[status];
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
      render: (_, record: FundAccountRecord) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  ...record,
                  accountNumber: record.account_number,
                  bankId: record.bank_id,
                });
                showEditModal(record);
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Sếp chắc chắn muốn xóa?"
              description={`Xóa tài khoản "${record.name}"?`}
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
              Quản lý Tài khoản & Quỹ tiền
            </Title>
            <Text type="secondary">
              Khai báo các quỹ tiền mặt và tài khoản ngân hàng của công ty.
            </Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ type: "cash", status: "active" });
                showAddModal();
              }}
            >
              Thêm Tài khoản/Quỹ
            </Button>
          </Col>
        </Row>

        {/* Phần 2: Bộ lọc (Sẽ kết nối sau) */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo tên, số tài khoản, địa điểm..."
              allowClear
            />
          </Col>
          <Col flex="200px">
            <Select
              placeholder="Lọc theo loại"
              allowClear
              style={{ width: "100%" }}
            >
              <Option value="cash">
                <WalletOutlined /> Tiền mặt
              </Option>
              <Option value="bank">
                <BankOutlined /> Ngân hàng
              </Option>
            </Select>
          </Col>
        </Row>

        {/* Phần 3: Bảng dữ liệu */}
        <Table
          columns={columns}
          dataSource={fundAccounts}
          bordered
          rowKey="key"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} tài khoản`,
          }}
          scroll={{ x: 1000 }}
        />
      </Spin>

      {/* Modal Thêm/Sửa */}
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {editingRecord
              ? `Sửa Tài khoản: ${editingRecord.name}`
              : "Thêm Tài khoản/Quỹ mới"}
          </Title>
        }
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={closeModal}
        okText={editingRecord ? "Lưu Cập nhật" : "Tạo mới"}
        cancelText="Hủy"
        width={600}
        destroyOnHidden
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: "cash", status: "active" }}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="name"
            label="Tên Tài khoản / Quỹ"
            rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
          >
            <Input placeholder="Vd: Quỹ tiền mặt Nhà thuốc ĐH 1" />
          </Form.Item>

          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Radio.Group onChange={(e) => setModalAccountType(e.target.value)}>
              <Radio value="cash">
                <WalletOutlined /> Tiền mặt
              </Radio>
              <Radio value="bank">
                <BankOutlined /> Ngân hàng
              </Radio>
            </Radio.Group>
          </Form.Item>

          {/* ----- FORM ĐỘNG (Conditional Fields) ----- */}
          {modalAccountType === "bank" && (
            <>
              {/* NÂNG CẤP V400: Dùng Select thay vì Input */}
              <Form.Item
                name="bankId"
                label="Ngân hàng"
                rules={[
                  { required: true, message: "Vui lòng chọn ngân hàng!" },
                ]}
              >
                <Select
                  showSearch
                  placeholder="Chọn từ danh sách ngân hàng VietQR"
                  options={banks.map((b) => ({
                    label: b.short_name,
                    value: b.id,
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
              <Form.Item
                name="accountNumber"
                label="Số Tài khoản"
                rules={[
                  { required: true, message: "Vui lòng nhập số tài khoản!" },
                ]}
              >
                <Input placeholder="Vd: 123456789xxx" />
              </Form.Item>
            </>
          )}

          {modalAccountType === "cash" && (
            <Form.Item
              name="location"
              label="Địa điểm / Người giữ quỹ"
              rules={[{ required: true, message: "Vui lòng nhập địa điểm!" }]}
            >
              <Input placeholder="Vd: Két sắt Nhà thuốc ĐH 1" />
            </Form.Item>
          )}
          {/* ----- KẾT THÚC FORM ĐỘNG ----- */}

          {!editingRecord && (
            <Form.Item
              name="initialBalance"
              label="Số dư ban đầu"
              initialValue={0 as number}
              tooltip="Nhập số dư hiện có khi Sếp bắt đầu đưa vào hệ thống."
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                min={0}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => Number(value!.replace(/đ\s?|(,*)/g, ""))}
                addonAfter="VNĐ"
              />
            </Form.Item>
          )}

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="active">Đang sử dụng</Option>
              <Option value="locked">Khóa (Không dùng)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default FundAccountPage;
