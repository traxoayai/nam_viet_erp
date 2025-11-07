import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MoreOutlined,
  BookOutlined, // Icon cho Kế toán
  ApartmentOutlined, // Icon cho cấu trúc cây
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  ConfigProvider,
  Space,
  Tag,
  Dropdown,
  Menu,
  Alert,
  Modal,
  Form,
  InputNumber,
  message,
  Tooltip,
  Popconfirm,
  TreeSelect, // Sử dụng TreeSelect để chọn tài khoản cha
  Switch, // Sử dụng Switch
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState } from "react";
import "dayjs/locale/vi";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// --- MOCK DATA (Dạng cây) ---
const mockAccountsData = [
  {
    key: "1",
    accountCode: "111",
    name: "Tiền mặt",
    type: "TaiSan",
    balanceType: "No",
    allowPosting: false, // Không cho phép hạch toán vào TK cha
    status: "active",
    children: [
      {
        key: "1-1",
        accountCode: "1111",
        name: "Tiền mặt tại quỹ (VNĐ)",
        type: "TaiSan",
        balanceType: "No",
        allowPosting: true,
        status: "active",
      },
      {
        key: "1-2",
        accountCode: "1112",
        name: "Tiền mặt tại quỹ (Ngoại tệ)",
        type: "TaiSan",
        balanceType: "No",
        allowPosting: true,
        status: "active",
      },
    ],
  },
  {
    key: "2",
    accountCode: "131",
    name: "Phải thu của khách hàng",
    type: "TaiSan",
    balanceType: "LuongTinh", // Lưỡng tính
    allowPosting: true,
    status: "active",
  },
  {
    key: "3",
    accountCode: "331",
    name: "Phải trả cho người bán",
    type: "NoPhaiTra",
    balanceType: "LuongTinh",
    allowPosting: true,
    status: "active",
  },
  {
    key: "4",
    accountCode: "511",
    name: "Doanh thu bán hàng và cung cấp dịch vụ",
    type: "DoanhThu",
    balanceType: "Co",
    allowPosting: false,
    status: "active",
    children: [
      {
        key: "4-1",
        accountCode: "5111",
        name: "Doanh thu bán hàng hóa",
        type: "DoanhThu",
        balanceType: "Co",
        allowPosting: true,
        status: "active",
      },
      {
        key: "4-2",
        accountCode: "5112",
        name: "Doanh thu bán DV y tế",
        type: "DoanhThu",
        balanceType: "Co",
        allowPosting: true,
        status: "active",
      },
    ],
  },
];

// Định nghĩa các loại tài khoản
const accountTypes = {
  TaiSan: { text: "Tài sản", color: "blue" },
  NoPhaiTra: { text: "Nợ phải trả", color: "red" },
  VonChuSoHuu: { text: "Vốn chủ sở hữu", color: "purple" },
  DoanhThu: { text: "Doanh thu", color: "green" },
  ChiPhi: { text: "Chi phí", color: "orange" },
};
const balanceTypes = {
  No: "Dư Nợ",
  Co: "Dư Có",
  LuongTinh: "Lưỡng tính",
};
const statusMap = {
  active: { text: "Sử dụng", color: "green" },
  inactive: { text: "Không sử dụng", color: "red" },
};

// Chuyển data sang dạng TreeSelect
const transformToTreeData = (nodes) => {
  return nodes.map((node) => ({
    value: node.accountCode,
    title: `${node.accountCode} - ${node.name}`,
    key: node.key,
    // Chỉ cho phép chọn TK cha (không cho hạch toán) làm cha
    disabled: node.allowPosting === true,
    children: node.children ? transformToTreeData(node.children) : [],
  }));
};

const ChartOfAccountsPage = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [form] = Form.useForm();
  const treeData = transformToTreeData(mockAccountsData); // Dữ liệu cho TreeSelect

  const onSelectChange = (keys) => {
    setSelectedRowKeys(keys);
  };

  const showAddModal = () => {
    setEditingAccount(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (record) => {
    setEditingAccount(record);
    // Tìm tài khoản cha (nếu có)
    const parent = mockAccountsData.find((p) =>
      p.children?.some((c) => c.key === record.key)
    );
    form.setFieldsValue({
      ...record,
      parentAccount: parent ? parent.accountCode : null,
    });
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingAccount(null);
    form.resetFields();
  };

  const handleModalSave = () => {
    form
      .validateFields()
      .then((values) => {
        form.resetFields();
        if (editingAccount) {
          message.success(
            `Cập nhật tài khoản ${values.accountCode} thành công!`
          );
        } else {
          message.success(
            `Thêm mới tài khoản ${values.accountCode} thành công!`
          );
        }
        setIsModalVisible(false);
        setEditingAccount(null);
        // Cần thêm logic để cập nhật lại bảng `mockAccountsData` (cả cấu trúc cây)
      })
      .catch((info) => {
        console.log("Validate Failed:", info);
      });
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  const columns = [
    {
      title: "Mã Tài khoản",
      dataIndex: "accountCode",
      key: "accountCode",
      width: 150,
    },
    {
      title: "Tên Tài khoản",
      dataIndex: "name",
      key: "name",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Loại Tài khoản",
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (type) => {
        const typeInfo = accountTypes[type] || {
          text: "Khác",
          color: "default",
        };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
      filters: Object.keys(accountTypes).map((key) => ({
        text: accountTypes[key].text,
        value: key,
      })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Tính chất",
      dataIndex: "balanceType",
      key: "balanceType",
      width: 120,
      render: (type) => balanceTypes[type],
    },
    {
      title: "Hạch toán",
      dataIndex: "allowPosting",
      key: "allowPosting",
      width: 100,
      align: "center",
      render: (allow) => (
        <Tag color={allow ? "green" : "default"}>
          {allow ? "Chi tiết" : "Tổng hợp"}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center",
      render: (status) => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
      filters: Object.keys(statusMap).map((key) => ({
        text: statusMap[key].text,
        value: key,
      })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
            />
          </Tooltip>
          <Tooltip
            title={
              record.children && record.children.length > 0
                ? "Không thể xóa TK cha"
                : "Xóa"
            }
          >
            <Popconfirm
              title="Xóa tài khoản này sẽ ảnh hưởng đến hạch toán. Sếp có chắc chắn?"
              onConfirm={() =>
                message.success(`Đã xóa tài khoản ${record.name}`)
              }
              okText="Đồng ý"
              cancelText="Hủy"
              disabled={record.children ? record.children.length > 0 : null}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={record.children ? record.children.length > 0 : null}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider locale={viVN}>
      <Card bordered={false}>
        {/* Phần 1: Header - Tiêu đề và Nút bấm */}
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 24 }}
        >
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              Hệ thống Tài khoản Kế toán
            </Title>
          </Col>
          <Col>
            <Space>
              <Button icon={<UploadOutlined />}>Nhập Excel</Button>
              <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showAddModal}
              >
                Thêm Tài khoản
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Phần 2: Bộ lọc */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col flex="auto">
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo Tên tài khoản, Mã tài khoản..."
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Loại tài khoản"
              style={{ width: 180 }}
              allowClear
              options={Object.keys(accountTypes).map((k) => ({
                label: accountTypes[k].text,
                value: k,
              }))}
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              style={{ width: 180 }}
              allowClear
              options={Object.keys(statusMap).map((k) => ({
                label: statusMap[k].text,
                value: k,
              }))}
            />
          </Col>
        </Row>

        {/* Phần 3: Bảng dữ liệu (Dạng Cây) */}
        <Table
          columns={columns}
          dataSource={mockAccountsData}
          bordered
          rowKey="key"
          pagination={false} // Thường HTTK không phân trang
          expandable={{
            defaultExpandAllRows: true, // Mở rộng tất cả các nút cha
            indentSize: 20,
          }}
        />

        {/* Modal để Thêm/Sửa */}
        <Modal
          title={
            editingAccount
              ? `Chỉnh sửa Tài khoản: ${editingAccount.name}`
              : "Thêm Tài khoản Kế toán Mới"
          }
          open={isModalVisible}
          onCancel={handleModalClose}
          onOk={handleModalSave}
          okText="Lưu thay đổi"
          cancelText="Hủy"
          width={800}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: "active",
              type: "TaiSan",
              balanceType: "No",
              allowPosting: true,
            }}
          >
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item
                  name="accountCode"
                  label="Mã Tài khoản"
                  rules={[{ required: true, message: "Vui lòng nhập mã TK!" }]}
                >
                  <Input placeholder="Vd: 1111, 5111" />
                </Form.Item>
              </Col>
              <Col span={18}>
                <Form.Item
                  name="name"
                  label="Tên Tài khoản"
                  rules={[{ required: true, message: "Vui lòng nhập tên TK!" }]}
                >
                  <Input placeholder="Vd: Tiền mặt tại quỹ (VNĐ)" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="parentAccount" label="Thuộc Tài khoản Cha">
                  <TreeSelect
                    style={{ width: "100%" }}
                    treeData={treeData}
                    allowClear
                    placeholder="Chọn tài khoản cha (nếu có)"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="Loại Tài khoản"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={Object.keys(accountTypes).map((k) => ({
                      label: accountTypes[k].text,
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="balanceType"
                  label="Tính chất Số dư"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={Object.keys(balanceTypes).map((k) => ({
                      label: balanceTypes[k],
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="status"
                  label="Trạng thái"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={Object.keys(statusMap).map((k) => ({
                      label: statusMap[k].text,
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="allowPosting"
                  label="Hạch toán chi tiết?"
                  valuePropName="checked"
                  tooltip="Tài khoản tổng hợp (cha) không nên cho phép hạch toán chi tiết."
                >
                  <Switch
                    checkedChildren="Cho phép"
                    unCheckedChildren="Không"
                    defaultChecked
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </Card>
    </ConfigProvider>
  );
};

export default ChartOfAccountsPage;
