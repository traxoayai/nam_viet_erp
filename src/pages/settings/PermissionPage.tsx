// src/pages/settings/PermissionPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  SaveOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  UserOutlined,
  MoreOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  // ShopOutlined,
  // AccountBookOutlined,
  // MedicineBoxOutlined,
  // SettingOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  LockOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  SafetyOutlined, // <-- THÊM DÒNG NÀY (Cho nút Duyệt)
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
  ConfigProvider,
  Tag,
  Dropdown,
  Modal,
  Form,
  App as AntApp,
  Tooltip,
  Popconfirm,
  Tree,
  Tabs,
  List,
  Avatar,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react";

import type { TableProps, TabsProps } from "antd";

// import { supabase } from "@/lib/supabaseClient";
import { useRoleStore } from "@/features/auth/stores/useRoleStore";
import { useUserStore } from "@/features/auth/stores/useUserStore";
import { Role } from "@/features/auth/types/role";
import { UserRoleInfo, UserAssignment } from "@/features/auth/types/user";
import { useWarehouseStore } from "@/features/inventory/stores/warehouseStore";

const { Text } = Typography;

// const roleColorMap: { [key: string]: string } = {
//   "Super-Admin": "gold",
//   "B2B-Manager": "blue",
//   "POS-Seller": "green",
//   Accountant: "cyan",
//   "Warehouse-Manager": "purple",
//   "HR-Manager": "magenta",
//   "Finance-Manager": "volcano",
// };

const statusMap: Record<
  UserRoleInfo["status"],
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Đang hoạt động",
    color: "success",
    icon: <CheckCircleOutlined />,
  },
  pending_approval: {
    label: "Chờ duyệt",
    color: "warning",
    icon: <ClockCircleOutlined />,
  },
  inactive: { label: "Tạm dừng", color: "default", icon: <StopOutlined /> },
};

// --- COMPONENT TAB 1 (ĐÃ VÁ LỖI 'bordered') ---
const TabRoleManagement: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm] = Form.useForm();

  const {
    roles,
    permissionsTree,
    selectedRole,
    checkedKeys,
    loadingRoles,
    loadingPermissions,
    loadingSaving,
    fetchRoles,
    fetchPermissions,
    selectRole,
    setCheckedKeysForRole,
    handleSavePermissions,
    addRole,
    updateRole,
    deleteRole,
  } = useRoleStore();

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const onTreeCheck = (checkedKeysValue: any) => {
    setCheckedKeysForRole(checkedKeysValue as string[]);
  };

  const onSavePermissions = async () => {
    const success = await handleSavePermissions();
    if (success) {
      antMessage.success(
        `Đã lưu quyền hạn cho vai trò "${selectedRole!.name}"!`
      );
    } else {
      antMessage.error("Lỗi khi lưu quyền hạn.");
    }
  };

  const showAddRoleModal = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setIsRoleModalVisible(true);
  };

  const showEditRoleModal = (role: Role) => {
    setEditingRole(role);
    roleForm.setFieldsValue(role);
    setIsRoleModalVisible(true);
  };

  const handleRoleModalSave = async () => {
    try {
      const values = await roleForm.validateFields();
      let success = false;
      if (editingRole) {
        success = await updateRole(editingRole.id, values);
        if (success) antMessage.success(`Đã cập nhật vai trò "${values.name}"`);
      } else {
        success = await addRole(values);
        if (success) antMessage.success(`Đã thêm vai trò mới "${values.name}"`);
      }
      if (success) setIsRoleModalVisible(false);
    } catch (error: any) {
      console.error("Lỗi lưu vai trò:", error);
      antMessage.error(`Thao tác thất bại: ${error.message}`);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    try {
      const success = await deleteRole(role.id);
      if (success) {
        antMessage.success(`Đã xóa vai trò "${role.name}"`);
      }
    } catch (error: any) {
      console.error("Lỗi xóa vai trò:", error);
      antMessage.error(`Lỗi khi xóa vai trò: ${error.message}`);
    }
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Card
          title="Danh sách Vai trò"
          variant="outlined" // <-- VÁ LỖI 'bordered' + TỐI ƯU UI
          styles={{ body: { padding: 12 } }}
          extra={
            <Tooltip title="Thêm vai trò mới">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showAddRoleModal}
              />
            </Tooltip>
          }
        >
          <Spin spinning={loadingRoles || loadingSaving}>
            <List
              itemLayout="horizontal"
              dataSource={roles}
              renderItem={(role) => (
                <List.Item
                  actions={[
                    <Tooltip title="Sửa tên/mô tả" key="edit">
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => showEditRoleModal(role)}
                      />
                    </Tooltip>,
                    <Popconfirm
                      key="delete"
                      title={`Xóa vai trò "${role.name}"?`}
                      onConfirm={() => handleDeleteRole(role)}
                      okText="Xóa"
                      cancelText="Hủy"
                    >
                      <Tooltip title="Xóa vai trò">
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>,
                  ]}
                  style={{
                    cursor: "pointer",
                    padding: "12px 8px",
                    borderRadius: "6px",
                    backgroundColor:
                      selectedRole?.id === role.id ? "#e6f7ff" : "transparent",
                    border:
                      selectedRole?.id === role.id
                        ? "1px solid #91d5ff"
                        : "1px solid transparent",
                  }}
                  onClick={() => selectRole(role)}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<TeamOutlined />} />}
                    title={<Text strong>{role.name}</Text>}
                    description={role.description || "Chưa có mô tả"}
                  />
                </List.Item>
              )}
            />
          </Spin>
        </Card>
      </Col>
      <Col xs={24} md={16}>
        <Card
          title={`Phân quyền chi tiết cho: ${selectedRole?.name || ""}`}
          variant="outlined" // <-- VÁ LỖI 'bordered' + TỐI ƯU UI
          styles={{ body: { padding: 12 } }}
          extra={
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSavePermissions}
              disabled={!selectedRole || loadingSaving}
              loading={loadingSaving}
            >
              Lưu Quyền hạn
            </Button>
          }
        >
          <Spin spinning={loadingPermissions || loadingRoles}>
            {selectedRole ? (
              <Tree
                checkable
                defaultExpandAll
                treeData={permissionsTree}
                checkedKeys={checkedKeys[selectedRole.id] || []}
                onCheck={onTreeCheck}
                showIcon
                style={{ padding: "12px" }}
              />
            ) : (
              <Text
                type="secondary"
                style={{ padding: "12px", display: "block" }}
              >
                Vui lòng chọn một vai trò bên trái để xem quyền hạn.
              </Text>
            )}
          </Spin>
        </Card>
      </Col>
      <Modal
        title={
          editingRole ? `Sửa vai trò: ${editingRole.name}` : "Tạo Vai trò Mới"
        }
        open={isRoleModalVisible}
        onOk={handleRoleModalSave}
        onCancel={() => setIsRoleModalVisible(false)}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={loadingSaving}
        destroyOnHidden
      >
        <Form form={roleForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="Tên Vai trò"
            rules={[{ required: true, message: "Vui lòng nhập tên vai trò!" }]}
          >
            <Input placeholder="Vd: Dược sĩ Trưởng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả vai trò">
            <Input.TextArea
              rows={3}
              placeholder="Mô tả ngắn gọn quyền hạn, trách nhiệm"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};
// --- Hết Component Tab 1 ---

// --- COMPONENT TAB 2 (ĐÃ VÁ LỖI 'bordered') ---
const UserAssignments: React.FC<{ assignments: UserAssignment[] | null }> = ({
  assignments,
}) => {
  if (!assignments || assignments.length === 0) {
    return <Text type="secondary">Chưa phân quyền</Text>;
  }
  return (
    <Space direction="vertical" size="small">
      {assignments.map((asm, index) => (
        <Tag
          key={index}
          color="blue"
          icon={<KeyOutlined />}
          style={{ margin: 0 }}
        >
          {asm.branchName}: <Text strong>{asm.roleName}</Text>
        </Tag>
      ))}
    </Space>
  );
};

// const statusMap = {
//   active: {
//     text: "Đang làm việc",
//     color: "green",
//     icon: <CheckCircleOutlined />,
//   },
//   paused: {
//     text: "Tạm nghỉ",
//     color: "orange",
//     icon: <PauseCircleOutlined />,
//   },
//   inactive: {
//     text: "Đã nghỉ việc",
//     color: "red",
//     icon: <StopOutlined />,
//   },
// };

const TabUserManagement: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  const [editUserForm] = Form.useForm();
  const [addUserForm] = Form.useForm();

  const {
    users,
    loadingUsers,
    isUserModalVisible,
    isAddUserModalVisible,
    editingUser,
    fetchUsers,
    showAddUserModal,
    showEditUserModal,
    closeModals,
    createUser,
    updateAssignments,
    updateUserStatus,
    deleteUser,
    approveUser,
  } = useUserStore();

  const { roles, fetchRoles } = useRoleStore();
  const { warehouses, fetchWarehouses } = useWarehouseStore();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchWarehouses();
  }, [fetchUsers, fetchRoles, fetchWarehouses]);

  const handleAddUserSave = async () => {
    try {
      const values = await addUserForm.validateFields();
      // Gọi hàm MỚI từ "bộ não" (đã bao gồm cả 3 trường)
      const success = await createUser(values);
      if (success) {
        antMessage.success(
          `Đã TẠO thành công user ${values.name} (${values.email})`
        );
        closeModals();
        addUserForm.resetFields();
      }
    } catch (error: any) {
      console.error("Lỗi tạo user:", error);
      antMessage.error(`Thêm người dùng thất bại: ${error.message}`);
    }
  };

  const handleEditUserModalSave = async () => {
    try {
      const values = await editUserForm.validateFields();
      const success = await updateAssignments(
        editingUser!.key,
        values.assignments || []
      );

      if (success) {
        antMessage.success(`Đã cập nhật phân quyền cho ${editingUser!.name}`);
        closeModals();
      }
    } catch (error: any) {
      console.error("Lỗi cập nhật phân quyền:", error);
      antMessage.error(`Cập nhật thất bại: ${error.message}`);
    }
  };

  const handleUpdateStatus = async (user: UserRoleInfo, newStatus: string) => {
    const success = await updateUserStatus(user.key, newStatus);
    if (success) {
      const statusText =
        statusMap[newStatus as keyof typeof statusMap]?.label || newStatus;
      antMessage.success(
        `Đã cập nhật trạng thái của ${user.name} thành "${statusText}"`
      );
    } else {
      antMessage.error("Cập nhật trạng thái thất bại.");
    }
  };

  const handleDeleteUser = async (user: UserRoleInfo) => {
    const success = await deleteUser(user.key);
    if (success) {
      antMessage.success(`Đã xóa người dùng ${user.name}`);
    } else {
      antMessage.error("Xóa thất bại.");
    }
  };

  /**
   * (MỚI) Xử lý Duyệt User
   */
  const handleApproveUser = async (user: UserRoleInfo) => {
    const msgKey = "approve_user";
    antMessage.loading({ content: "Đang duyệt user...", key: msgKey });
    try {
      await approveUser(user.key); // user.key là user_id
      antMessage.success({
        content: `Đã duyệt thành công user ${user.name}`,
        key: msgKey,
      }); // (Store đã tự tải lại danh sách)
    } catch (error: any) {
      console.error("Lỗi khi duyệt user:", error);
      antMessage.error({
        content: `Duyệt thất bại: ${error.message}`,
        key: msgKey,
      });
    }
  };

  const openEditModal = (user: UserRoleInfo) => {
    const assignmentsWithKeys = (user.assignments || []).map((asm) => ({
      ...asm,
      key: Math.random(),
    }));
    editUserForm.setFieldsValue({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      assignments: assignmentsWithKeys,
    });
    showEditUserModal(user);
  };

  const userColumns: TableProps<UserRoleInfo>["columns"] = [
    {
      title: "Nhân viên",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space>
          <Avatar src={record.avatar} icon={<UserOutlined />} />
          <Space direction="vertical" size={0}>
            <Text strong>{text || "(Chưa cập nhật)"}</Text>
            <Text type="secondary">{record.email}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Chi nhánh & Vai trò",
      dataIndex: "assignments",
      key: "assignments",
      width: "40%",
      render: (assignments: UserAssignment[] | null) => (
        <UserAssignments assignments={assignments} />
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 180, // Tăng độ rộng
      render: (status: UserRoleInfo["status"]) => {
        const statusInfo = statusMap[status] || statusMap.inactive;
        return (
          <Tag icon={statusInfo.icon} color={statusInfo.color}>
            {statusInfo.label}
          </Tag>
        );
      }, // SỬA: Thêm filter "Chờ duyệt"
      filters: [
        { text: "Đang hoạt động", value: "active" },
        { text: "Chờ duyệt", value: "pending_approval" },
        { text: "Tạm dừng", value: "inactive" },
      ],
      onFilter: (value: any, record) => record.status === value,
    },
    {
      title: "Hành động",
      key: "action",
      align: "center" as const,
      width: 100,
      render: (_, record: UserRoleInfo) => {
        // SỬA LỖI: LOGIC NÚT DUYỆT
        if (record.status === "pending_approval") {
          return (
            <Tooltip title="Duyệt Hồ sơ">
              <Popconfirm
                title={`Duyệt cho user "${record.name}" vào hệ thống?`}
                okText="Duyệt"
                onConfirm={() => handleApproveUser(record)}
              >
                <Button
                  type="text"
                  style={{ color: "green" }}
                  icon={<SafetyOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          );
        } // (Nếu không pending, hiển thị menu cũ)

        return (
          <Dropdown
            menu={{
              items: [
                {
                  key: "1",
                  icon: <EditOutlined />,
                  label: "Sửa Thông tin & Phân quyền",
                  onClick: () => openEditModal(record),
                },
                {
                  key: "2",
                  icon: <CheckCircleOutlined />,
                  label: "Cập nhật Trạng thái",
                  children: [
                    {
                      key: "2-1",
                      icon: <CheckCircleOutlined />,
                      label: "Đang làm việc",
                      onClick: () => handleUpdateStatus(record, "active"),
                      disabled: record.status === "active",
                    }, // (Sửa lỗi: File Sếp gửi thiếu "paused")
                    {
                      key: "2-2",
                      icon: <PauseCircleOutlined />,
                      label: "Tạm dừng",
                      onClick: () => handleUpdateStatus(record, "inactive"),
                      disabled: record.status === "inactive",
                    },
                  ],
                },
                { type: "divider" },
                {
                  key: "3",
                  icon: <DeleteOutlined />,
                  danger: true,
                  label: "Xóa người dùng (Nguy hiểm)", // SỬA: Chỉ dùng Text
                  // SỬA: Chuyển logic sang onClick
                  onClick: () => {
                    Modal.confirm({
                      title: `XÓA VĨNH VIỄN user "${record.name}"?`,
                      content:
                        "Hành động này sẽ XÓA user khỏi Auth. Chỉ dùng khi Sếp tạo nhầm.",
                      okText: "Xóa Vĩnh viễn",
                      okType: "danger",
                      cancelText: "Hủy",
                      onOk: () => handleDeleteUser(record),
                    });
                  },
                },
              ],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <Spin spinning={loadingUsers} tip="Đang tải danh sách người dùng...">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo Tên nhân viên, Email..."
            allowClear
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={showAddUserModal}
          >
            Thêm người dùng mới
          </Button>
        </Col>
      </Row>

      <Table
        columns={userColumns}
        dataSource={users}
        bordered
        rowKey="key"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={
          <Space>
            <UserAddOutlined /> Thêm Người dùng Mới
          </Space>
        }
        open={isAddUserModalVisible}
        onOk={handleAddUserSave}
        onCancel={closeModals}
        okText="Gửi Lời mời"
        cancelText="Hủy"
        confirmLoading={loadingUsers}
        destroyOnHidden
      >
        <Form form={addUserForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label="Họ và Tên"
            rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
          >
            <Input placeholder="Vd: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email (dùng để đăng nhập)"
            rules={[
              { required: true, message: "Vui lòng nhập email!" },
              { type: "email", message: "Email không hợp lệ!" },
            ]}
          >
            <Input placeholder="Vd: a.nv@namviet.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu tạm thời"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu tạm!" },
              { min: 6, message: "Mật khẩu phải ít nhất 6 ký tự!" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Vd: NamViet@123"
            />
          </Form.Item>
          <Text type="secondary">
            Tạo mới User và Gán mật khẩu tạm thời. Một Email sẽ gửi tới User để
            họ đổi Mật Khẩu.
          </Text>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <EditOutlined />
            {`Sửa Thông tin & Phân quyền: ${editingUser?.name || ""}`}
          </Space>
        }
        open={isUserModalVisible}
        onOk={handleEditUserModalSave}
        onCancel={closeModals}
        width={800}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={loadingUsers}
        destroyOnHidden
      >
        <Form
          form={editUserForm}
          layout="vertical"
          autoComplete="off"
          style={{ marginTop: 24 }}
        >
          <Tabs
            defaultActiveKey="perms"
            items={[
              {
                key: "perms",
                label: "Phân quyền (Chi nhánh & Vai trò)",
                children: (
                  <Form.List name="assignments">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Card
                            key={key}
                            size="small"
                            style={{
                              marginBottom: 16,
                            }}
                            variant="outlined" // <-- VÁ LỖI 'bordered'
                            styles={{
                              body: { paddingBottom: 8 },
                            }}
                            // bodyStyle={{ paddingBottom: 8 }}
                          >
                            <Row gutter={16} align="middle">
                              <Col flex="auto">
                                <Form.Item
                                  {...restField}
                                  name={[name, "branchId"]}
                                  label="Tại Chi nhánh"
                                  rules={[
                                    {
                                      required: true,
                                      message: "Chọn chi nhánh!",
                                    },
                                  ]}
                                >
                                  <Select
                                    placeholder="Chọn chi nhánh..."
                                    options={warehouses.map((b) => ({
                                      label: b.name,
                                      value: b.id,
                                    }))}
                                  />
                                </Form.Item>
                              </Col>
                              <Col flex="auto">
                                <Form.Item
                                  {...restField}
                                  name={[name, "roleId"]}
                                  label="Vai trò là"
                                  rules={[
                                    {
                                      required: true,
                                      message: "Chọn vai trò!",
                                    },
                                  ]}
                                >
                                  <Select
                                    placeholder="Chọn vai trò..."
                                    options={roles.map((r) => ({
                                      label: r.name,
                                      value: r.id,
                                    }))}
                                  />
                                </Form.Item>
                              </Col>
                              <Col>
                                <Tooltip title="Xóa phân quyền này">
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(name)}
                                    style={{ marginTop: 8 }}
                                  />
                                </Tooltip>
                              </Col>
                            </Row>
                          </Card>
                        ))}
                        <Form.Item>
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            block
                            icon={<PlusOutlined />}
                          >
                            Thêm Phân quyền tại Chi nhánh Khác
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                ),
              },
              {
                key: "info",
                label: "Thông tin cơ bản",
                children: (
                  <>
                    <Form.Item name="name" label="Họ và Tên">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item name="email" label="Email (dùng để đăng nhập)">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item name="avatar" label="URL Ảnh đại diện">
                      <Input placeholder="Dán link ảnh .png/.jpg..." disabled />
                    </Form.Item>
                    <Text type="secondary">
                      (SENKO: Chức năng sửa thông tin user Sếp sẽ làm ở module
                      "Quản lý Hồ sơ Nhân viên".)
                    </Text>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </Spin>
  );
};
// --- Hết Component Tab 2 ---

// --- COMPONENT CHÍNH CỦA TRANG (ĐÃ VÁ LỖI TABS) ---
const PermissionManagementPage: React.FC = () => {
  const tabItems: TabsProps["items"] = [
    {
      key: "1",
      label: (
        <Space>
          <CheckSquareOutlined />
          Quản lý Vai trò & Quyền hạn
        </Space>
      ),
      children: <TabRoleManagement />,
    },
    {
      key: "2",
      label: (
        <Space>
          <UserOutlined />
          Quản lý Người dùng
        </Space>
      ),
      children: <TabUserManagement />,
    },
  ];

  return (
    <ConfigProvider locale={viVN}>
      {/* TỐI ƯU UI: Giảm padding, bỏ margin */}
      <Card
        variant="outlined" // <-- VÁ LỖI 'bordered' + TỐI ƯU UI
        styles={{ body: { padding: "0 12px 12px 12px" } }}
      >
        <Typography.Title level={4} style={{ margin: "12px 0 12px 12px" }}>
          <SafetyCertificateOutlined /> Quản lý Người dùng & Phân quyền
        </Typography.Title>

        <Tabs defaultActiveKey="1" type="card" items={tabItems} />
      </Card>
    </ConfigProvider>
  );
};

export default PermissionManagementPage;
