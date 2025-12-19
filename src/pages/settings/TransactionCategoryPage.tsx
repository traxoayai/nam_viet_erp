// src/pages/settings/TransactionCategoryPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AccountBookOutlined,
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
  App as AntApp,
  Tooltip,
  Popconfirm,
  Radio,
  TreeSelect,
  Spin,
} from "antd";
import React, { useEffect } from "react";

import type { TableProps } from "antd";

import { useTransactionCategoryStore } from "@/features/finance/stores/useTransactionCategoryStore";
import { TransactionCategoryRecord } from "@/features/finance/types/transactionCategory";

const { Title, Text } = Typography;
const { Option } = Select;

// --- CÁC ĐỊNH NGHĨA (Maps) ---
const typeMap = {
  thu: { text: "Khoản Thu", color: "success" },
  chi: { text: "Khoản Chi", color: "error" },
};
const statusMap = {
  active: { text: "Hoạt động", color: "success" },
  inactive: { text: "Không hoạt động", color: "default" },
};

// --- COMPONENT CHÍNH ---
const TransactionCategoryPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();

  // --- NÂNG CẤP V400: Lấy dữ liệu từ "bộ não" ---
  const {
    categories,
    masterCoaTree, // Cây HTTK (chưa lọc)
    filteredCoaTree, // Cây HTTK (đã lọc)
    loading,
    isModalVisible,
    editingRecord,
    fetchCategories,
    fetchCoaTree, // Tải cây HTTK
    setModalCategoryType, // Hàm lọc cây
    showAddModal,
    showEditModal,
    closeModal,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useTransactionCategoryStore();

  // Tải dữ liệu lần đầu
  useEffect(() => {
    fetchCategories();
    fetchCoaTree(); // Tải cây HTTK
  }, [fetchCategories, fetchCoaTree]);

  // --- HÀM XỬ LÝ (Handlers) ---
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      // Lấy tên TK Kế toán (để cập nhật UI ngay)
      const findAccountName = (nodes: any[], value: string): string | null => {
        for (const node of nodes) {
          if (node.value === value) return node.title;
          if (node.children) {
            const found = findAccountName(node.children, value);
            if (found) return found;
          }
        }
        return null;
      };
      const accountName =
        findAccountName(masterCoaTree, values.accountId) || "N/A";

      const recordToSave = { ...values, accountName };

      let success = false;
      if (editingRecord) {
        // Logic Sửa
        success = await updateCategory(editingRecord.id, recordToSave);
        if (success)
          antMessage.success(`Cập nhật loại "${values.name}" thành công!`);
      } else {
        // Logic Thêm
        success = await addCategory(recordToSave);
        if (success)
          antMessage.success(`Thêm mới loại "${values.name}" thành công!`);
      }

      if (success) {
        closeModal();
      } else {
        antMessage.error("Thao tác thất bại. Mã Code có thể đã tồn tại.");
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const handleDelete = async (record: TransactionCategoryRecord) => {
    const success = await deleteCategory(record.id);
    if (success) {
      antMessage.success(`Đã xóa loại "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại.");
    }
  };

  // --- ĐỊNH NGHĨA CỘT (Columns) ---
  const columns: TableProps<TransactionCategoryRecord>["columns"] = [
    {
      title: "Mã Loại",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Tên Loại Thu / Chi",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (type: "thu" | "chi") => (
        <Tag color={typeMap[type].color}>{typeMap[type].text}</Tag>
      ),
      filters: [
        { text: "Khoản Thu", value: "thu" },
        { text: "Khoản Chi", value: "chi" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "TK Kế toán Liên kết",
      dataIndex: "accountName",
      key: "accountName",
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <Tag icon={<AccountBookOutlined />} color="default">
            {record.account_id}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      align: "center",
      render: (status: "active" | "inactive") => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
      filters: [
        { text: "Hoạt động", value: "active" },
        { text: "Không hoạt động", value: "inactive" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      width: 120,
      align: "center",
      fixed: "right",
      render: (_, record: TransactionCategoryRecord) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                form.setFieldsValue({
                  ...record,
                  accountId: record.account_id, // Đổi tên
                });
                showEditModal(record);
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Sếp chắc chắn muốn xóa?"
              description={`Xóa loại "${record.name}"?`}
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
              Quản lý Loại Thu - Chi
            </Title>
            <Text type="secondary">
              Tạo các lý do thu chi và liên kết với tài khoản kế toán.
            </Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              Thêm Loại Thu/Chi Mới
            </Button>
          </Col>
        </Row>

        {/* Phần 2: Bộ lọc (Sẽ kết nối sau) */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo Tên, Mã, Tài khoản KT..."
              allowClear
            />
          </Col>
          <Col flex="200px">
            <Select
              placeholder="Lọc theo loại"
              allowClear
              style={{ width: "100%" }}
            >
              <Option value="thu">Khoản Thu</Option>
              <Option value="chi">Khoản Chi</Option>
            </Select>
          </Col>
          <Col flex="200px">
            <Select
              placeholder="Lọc theo trạng thái"
              allowClear
              style={{ width: "100%" }}
            >
              <Option value="active">Đang hoạt động</Option>
              <Option value="inactive">Không hoạt động</Option>
            </Select>
          </Col>
        </Row>

        {/* Phần 3: Bảng dữ liệu */}
        <Table
          columns={columns}
          dataSource={categories}
          bordered // <-- TỐI ƯU UI
          rowKey="key"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} loại`,
          }}
          scroll={{ x: 1000 }}
        />
      </Spin>

      {/* Modal Thêm/Sửa */}
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            {editingRecord
              ? `Sửa Loại: ${editingRecord.name}`
              : "Thêm Loại Thu/Chi Mới"}
          </Title>
        }
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={closeModal}
        okText={editingRecord ? "Lưu Cập nhật" : "Tạo mới"}
        cancelText="Hủy"
        width={700}
        destroyOnHidden // <-- VÁ LỖI
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: "chi", status: "active" }}
          style={{ marginTop: 24 }}
        >
          <Row gutter={24}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="Tên Loại Thu/Chi"
                rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
              >
                <Input placeholder="Vd: Chi Lương Nhân viên" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="code"
                label="Mã (Viết tắt)"
                rules={[{ required: true, message: "Vui lòng nhập mã!" }]}
                tooltip="Vd: CHI_LUONG, THU_BANLE"
              >
                <Input placeholder="Vd: CHI_LUONG" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Radio.Group onChange={(e) => setModalCategoryType(e.target.value)}>
              <Radio value="thu">Khoản Thu</Radio>
              <Radio value="chi">Khoản Chi</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="accountId"
            label="Tài khoản Kế toán liên kết (Gợi ý)"
            rules={[
              { required: true, message: "Vui lòng liên kết 1 tài khoản!" },
            ]}
          >
            <TreeSelect
              showSearch
              style={{ width: "100%" }}
              dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
              placeholder="Tìm TK Kế toán (Vd: 5111 hoặc 'Doanh thu')"
              allowClear
              treeDefaultExpandAll
              treeData={filteredCoaTree} // <-- Dùng cây đã lọc
              filterTreeNode={(inputValue, treeNode) =>
                String(treeNode?.title ?? "") // Vá lỗi TS
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="active">Đang hoạt động</Option>
              <Option value="inactive">Không hoạt động</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Mô tả / Diễn giải">
            <Input.TextArea
              rows={3}
              placeholder="Ghi chú thêm về loại thu/chi này..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default TransactionCategoryPage;
