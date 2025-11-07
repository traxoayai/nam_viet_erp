// src/pages/finance/ChartOfAccountsPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
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
  Select,
  Row,
  Col,
  ConfigProvider,
  Space,
  Tag,
  Modal,
  Form,
  Tooltip,
  Popconfirm,
  TreeSelect,
  Switch,
  Spin,
  App as AntApp, // Import AntApp
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react";

import type { TableProps } from "antd"; // Import kiểu dữ liệu

import "dayjs/locale/vi";

// --- NÂNG CẤP V400: Sử dụng Alias Path ---
import { supabase } from "@/lib/supabaseClient";

const { Title, Text } = Typography;

// --- NÂNG CẤP V400: Định nghĩa Types ---
// Kiểu dữ liệu thô từ CSDL
interface Account {
  id: string; // UUID
  account_code: string;
  name: string;
  parent_id: string | null;
  type: "TaiSan" | "NoPhaiTra" | "VonChuSoHuu" | "DoanhThu" | "ChiPhi";
  balance_type: "No" | "Co" | "LuongTinh";
  status: "active" | "inactive";
  allow_posting: boolean;
}

// Kiểu dữ liệu đã được build thành cây
interface AccountNode extends Account {
  key: string; // AntD Table cần 'key' là string
  children?: AccountNode[];
}

// Kiểu dữ liệu cho TreeSelect
interface TreeSelectNode {
  value: string;
  title: string;
  key: string;
  children?: TreeSelectNode[];
  disabled?: boolean;
}

// --- Định nghĩa tĩnh (Giữ nguyên) ---
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

// --- HÀM BUILD CÂY (NÂNG CẤP TYPES) ---
const buildTree = (list: Account[]): AccountNode[] => {
  const map: { [key: string]: AccountNode } = {};
  const roots: AccountNode[] = [];

  list.forEach((node) => {
    map[node.id] = { ...node, key: node.id, children: [] };
  });

  list.forEach((node) => {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children!.push(map[node.id]);
    } else {
      roots.push(map[node.id]);
    }
  });

  Object.values(map).forEach((node) => {
    if (node.children && node.children.length === 0) {
      delete node.children;
    }
  });

  return roots;
};

// --- HÀM CHUYỂN ĐỔI TREE SELECT (NÂNG CẤP TYPES) ---
const transformToTreeData = (nodes: AccountNode[]): TreeSelectNode[] => {
  return nodes.map((node) => ({
    value: node.id, // Dùng 'id' (UUID) làm value
    title: `${node.account_code} - ${node.name}`,
    key: node.id,
    children: node.children ? transformToTreeData(node.children) : [],
    // Chỉ cho phép hạch toán vào TK chi tiết (allow_posting = true)
    // -> Vô hiệu hóa các TK cha (tổng hợp)
    disabled: !node.allow_posting,
  }));
};

// --- NÂNG CẤP V400: ĐỊNH NGHĨA COMPONENT VỚI React.FC ---
const ChartOfAccountsPage: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const [accountsData, setAccountsData] = useState<AccountNode[]>([]);
  const [treeSelectData, setTreeSelectData] = useState<TreeSelectNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountNode | null>(
    null
  );
  const [form] = Form.useForm();

  // --- LOGIC LẤY DỮ LIỆU (NÂNG CẤP TYPES) ---
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("account_code", { ascending: true });

      if (error) throw error;

      const accountList = data as Account[];
      const treeData = buildTree(accountList);
      setAccountsData(treeData);

      // Tạo dữ liệu cho TreeSelect (bao gồm cả TK cha và con)
      setTreeSelectData(transformToTreeData(treeData));
    } catch (error: any) {
      antMessage.error(`Lỗi khi tải hệ thống tài khoản: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // --- LOGIC MODAL (NÂNG CẤP TYPES) ---
  const showAddModal = () => {
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({
      status: "active",
      allow_posting: true, // Mặc định là TK chi tiết
      balance_type: "LuongTinh", // Mặc định Lưỡng tính cho dễ
      type: "TaiSan",
    });
    setIsModalVisible(true);
  };

  const showEditModal = (record: AccountNode) => {
    setEditingAccount(record);
    form.setFieldsValue({
      ...record,
      parentAccount: record.parent_id || null, // Dùng parent_id
    });
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingAccount(null);
    form.resetFields();
  };

  // --- LOGIC CRUD (NÂNG CẤP) ---
  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();

      // Dữ liệu chuẩn bị để gửi lên CSDL
      const recordToSave = {
        account_code: values.account_code,
        name: values.name,
        parent_id: values.parentAccount || null,
        type: values.type,
        balance_type: values.balance_type,
        status: values.status,
        allow_posting: values.allow_posting,
      };

      setLoading(true);

      if (editingAccount) {
        // --- CHẾ ĐỘ CẬP NHẬT ---
        const { error } = await supabase
          .from("chart_of_accounts")
          .update(recordToSave)
          .eq("id", editingAccount.id);

        if (error) throw error;
        antMessage.success(
          `Cập nhật tài khoản ${values.account_code} thành công!`
        );
      } else {
        // --- CHẾ ĐỘ THÊM MỚI ---
        const { error } = await supabase
          .from("chart_of_accounts")
          .insert(recordToSave);

        if (error) throw error;
        antMessage.success(
          `Thêm mới tài khoản ${values.account_code} thành công!`
        );
      }

      await fetchAccounts(); // Tải lại toàn bộ cây
      handleModalClose();
    } catch (error: any) {
      antMessage.error(`Lỗi khi lưu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record: AccountNode) => {
    if (record.children && record.children.length > 0) {
      antMessage.error(
        "Không thể xóa tài khoản tổng hợp khi còn tài khoản con!"
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("chart_of_accounts")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      antMessage.success(`Đã xóa tài khoản ${record.name}`);
      await fetchAccounts(); // Tải lại cây
    } catch (error: any) {
      antMessage.error(
        `Lỗi khi xóa: ${error.message}. Có thể tài khoản này đang được sử dụng.`
      );
    } finally {
      setLoading(false);
    }
  };

  // --- NÂNG CẤP V400: ĐỊNH NGHĨA KIỂU CHO CỘT ---
  const columns: TableProps<AccountNode>["columns"] = [
    {
      title: "Mã Tài khoản",
      dataIndex: "account_code",
      key: "account_code",
      width: 150,
      fixed: "left",
    },
    {
      title: "Tên Tài khoản",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      width: 300,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Loại Tài khoản",
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (type: Account["type"]) => {
        const typeInfo = accountTypes[type] || {
          text: "Khác",
          color: "default",
        };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
      filters: Object.keys(accountTypes).map((key) => ({
        text: accountTypes[key as Account["type"]].text,
        value: key,
      })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "Tính chất",
      dataIndex: "balance_type",
      key: "balance_type",
      width: 120,
      render: (type: Account["balance_type"]) => balanceTypes[type],
    },
    {
      title: "Hạch toán",
      dataIndex: "allow_posting",
      key: "allow_posting",
      width: 100,
      align: "center",
      render: (allow: boolean) => (
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
      render: (status: Account["status"]) => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
      filters: Object.keys(statusMap).map((key) => ({
        text: statusMap[key as Account["status"]].text,
        value: key,
      })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 100,
      fixed: "right",
      render: (_, record: AccountNode) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Xóa tài khoản này? Sếp có chắc chắn?"
              onConfirm={() => handleDelete(record)}
              okText="Đồng ý"
              cancelText="Hủy"
              disabled={!!(record.children && record.children.length > 0)}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!!(record.children && record.children.length > 0)}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider locale={viVN}>
      <Card styles={{ body: { padding: 12 } }}>
        {/* Phần 1: Header */}
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
              <Button
                icon={<UploadOutlined />}
                onClick={() => antMessage.info("Chức năng đang phát triển")}
              >
                Nhập Excel
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => antMessage.info("Chức năng đang phát triển")}
              >
                Xuất Excel
              </Button>
              <Tooltip title="Tải lại dữ liệu">
                <Button
                  icon={<SyncOutlined />}
                  onClick={fetchAccounts}
                  loading={loading}
                />
              </Tooltip>
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

        {/* Phần 2: Bộ lọc (Sẽ nâng cấp sau) */}
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
                label: accountTypes[k as Account["type"]].text,
                value: k,
              }))}
            />
          </Col>
        </Row>

        {/* Phần 3: Bảng dữ liệu */}
        <Spin spinning={loading} tip="Đang tải...">
          <Table
            columns={columns}
            dataSource={accountsData}
            bordered
            rowKey="id"
            pagination={false} // HTTK không phân trang
            expandable={{
              defaultExpandAllRows: true,
              indentSize: 15,
            }}
            scroll={{ x: "max-content" }}
          />
        </Spin>

        {/* Modal để Thêm/Sửa */}
        <Modal
          title={
            editingAccount
              ? `Chỉnh sửa TK: ${editingAccount.name}`
              : "Thêm Tài khoản Kế toán Mới"
          }
          open={isModalVisible}
          onCancel={handleModalClose}
          onOk={handleModalSave}
          confirmLoading={loading}
          okText="Lưu thay đổi"
          cancelText="Hủy"
          width={800}
          destroyOnHidden
        >
          <Form form={form} layout="vertical">
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item
                  name="account_code"
                  label="Mã Tài khoản"
                  rules={[{ required: true, message: "Vui lòng nhập mã TK!" }]}
                >
                  <Input
                    placeholder="Vd: 1111, 5111"
                    disabled={!!editingAccount}
                  />
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
                    treeData={treeSelectData}
                    allowClear
                    placeholder="Chọn tài khoản cha (nếu có)"
                    treeDefaultExpandAll
                    filterTreeNode={(input, node) =>
                      String(node?.title ?? "") // <-- SỬA LỖI: Ép kiểu an toàn
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
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
                      label: accountTypes[k as Account["type"]].text,
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="balance_type"
                  label="Tính chất Số dư"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={Object.keys(balanceTypes).map((k) => ({
                      label: balanceTypes[k as Account["balance_type"]],
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
                      label: statusMap[k as Account["status"]].text,
                      value: k,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="allow_posting"
                  label="Cho phép hạch toán?"
                  valuePropName="checked"
                >
                  <Switch
                    checkedChildren="Cho phép (Chi tiết)"
                    unCheckedChildren="Không (Tổng hợp)"
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
