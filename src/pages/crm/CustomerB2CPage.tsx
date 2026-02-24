// src/pages/crm/CustomerB2CPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  HistoryOutlined,
  DownloadOutlined,
  UploadOutlined,
  UsergroupAddOutlined,
  SafetyOutlined,
  MinusCircleOutlined,
  SmileOutlined,
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
  Space,
  Tag,
  Form,
  App as AntApp,
  Tooltip,
  Popconfirm,
  DatePicker,
  Divider,
  Affix,
  Upload,
  ConfigProvider,
  Radio,
  Tabs,
  Empty,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

import type { TableProps, UploadProps } from "antd";
// import type { UploadRequestOption } from "antd/es/upload/interface";

// IMPORT CÁC "BỘ NÃO" VÀ "KHUÔN MẪU"
import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]
import { uploadAvatar } from "@/features/sales/api/customerService"; // Chỉ import service upload
import { useDebounce } from "@/shared/hooks/useDebounce";
import GuardianSelectModal from "@/shared/ui/common/GuardianSelectModal";
import { useCustomerB2CStore } from "@/features/sales/stores/useCustomerB2CStore";
// import { useUserStore } from "@/stores/useUserStore"; // Dùng cho Tab Giám hộ
// import { useWarehouseStore } from "@/stores/warehouseStore"; // Dùng cho Tab Tổ chức (sau)
import {
  CustomerListRecord,
  CustomerB2CType,
  CustomerStatus,
  CustomerHistory,
  //   CustomerGuardian,
  CustomerFormData,
} from "@/features/sales/types/customer";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

import { Access } from "@/shared/components/auth/Access"; // [NEW]
import { PermissionGuard } from "@/shared/components/auth/PermissionGuard"; // [NEW]

// --- CSS INLINE (Style từ Canvas) ---
// SỬA LỖI B & G: Bỏ style 'layout' và 'cardBody'
const styles = {
  card: {
    margin: "0px",
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
  formListCard: {
    border: "1.5px dashed #d0d7de",
    backgroundColor: "#fcfcfc",
    marginBottom: 12,
  },
};

// --- HÀM TĨNH (Từ Canvas) ---
const customerTypeMap = {
  CaNhan: { text: "Cá nhân (Bệnh nhân)", color: "green" },
  ToChuc: { text: "Tổ chức (Mua lẻ)", color: "blue" },
};
const statusMap = {
  active: { text: "Đang GD", color: "success" },
  inactive: { text: "Ngừng GD", color: "default" },
};
const maritalStatusOptions = [
  { value: "Độc thân", label: "Độc thân" },
  { value: "Đã kết hôn", label: "Đã kết hôn" },
  { value: "Khác", label: "Khác" },
];

const calculateDetailedAge = (birthday: any) => {
  if (!birthday) return "N/A";
  let birthDate = dayjs(birthday);
  if (!birthDate.isValid()) return "N/A";
  const today = dayjs();
  const years = today.diff(birthDate, "year");
  birthDate = birthDate.add(years, "year");
  const months = today.diff(birthDate, "month");
  birthDate = birthDate.add(months, "month");
  const days = today.diff(birthDate, "day");
  return `${years} tuổi, ${months} tháng, ${days} ngày`;
};

const phoneFormatter = (value: string | undefined) => {
  if (!value) return "";
  const phoneNumber = value.replace(/[^\d]/g, "");
  const match = phoneNumber.match(/^(\d{0,4})(\d{0,3})(\d{0,3})$/);
  if (!match) return phoneNumber;
  return [match[1], match[2], match[3]].filter(Boolean).join(".");
};

// --- COMPONENT CHÍNH ---
const CustomerB2CPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { message: antMessage, modal: antModal } = AntApp.useApp(); // SỬA LỖI H: antMessage
  // Lấy state từ "bộ não"
  const {
    customers,
    loading,
    isFormView, // SỬA LỖI G: Dùng 'isFormView' thay 'viewMode'
    editingCustomer, // SỬA LỖI E: Dùng 'editingCustomer' thay 'editingRecord'
    editingCustomerType,
    totalCount,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    reactivateCustomer,
    exportToExcel,
    importCustomers,
    page,
    pageSize,
    setPage,
    showListView,
    showFormView,
  } = useCustomerB2CStore(); // State cục bộ

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [fileList, setFileList] = useState<any[]>([]);
  const [cccdFiles, setCccdFiles] = useState<{ truoc: any[]; sau: any[] }>({
    truoc: [],
    sau: [],
  });
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false); // Khai báo 'isNew' TRƯỚC khi dùng trong useEffect
  const isNew = !editingCustomer && isFormView; // Thêm state để lưu index của Form.List
  const [currentGuardianField, setCurrentGuardianField] = useState<
    number | null
  >(null); // Tải danh sách
  const [isImporting, setIsImporting] = useState(false);

  const loadCustomers = useCallback(() => {
    fetchCustomers({ search_query: debouncedSearch });
  }, [fetchCustomers, debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch]); // Điền form khi dữ liệu Sửa về

  useEffect(() => {
    if (!isNew && editingCustomer && !loading) {
      const customer = editingCustomer.customer;
      const initialValues = {
        ...customer, // Chuyển đổi ngày tháng
        dob: customer.dob ? dayjs(customer.dob) : null,
        cccd_issue_date: customer.cccd_issue_date
          ? dayjs(customer.cccd_issue_date)
          : null,
        phone: phoneFormatter(customer.phone || undefined), // Format SĐT
        // SỬA LỖI E: Dùng 'editingCustomer.guardians'
        guardians: (editingCustomer.guardians || []).map((g) => ({
          ...g,
          key: uuidv4(),
        })),
        history: (editingCustomer.history || []).map((h) => ({
          ...h,
          key: uuidv4(),
        })),
      };
      form.setFieldsValue(initialValues); // Setup ảnh
      setFileList(
        customer.avatar_url
          ? [
              {
                uid: "-1",
                name: "avatar.png",
                status: "done",
                url: customer.avatar_url,
              },
            ]
          : []
      );
      setCccdFiles({
        truoc: customer.cccd_front_url
          ? [
              {
                uid: "cccd_t",
                name: "cccd_truoc.png",
                status: "done",
                url: customer.cccd_front_url,
              },
            ]
          : [],
        sau: customer.cccd_back_url
          ? [
              {
                uid: "cccd_s",
                name: "cccd_sau.png",
                status: "done",
                url: customer.cccd_back_url,
              },
            ]
          : [],
      });
    } else if (isNew) {
      form.resetFields();
      form.setFieldsValue({
        type: "CaNhan",
        status: "active",
        guardians: [],
        history: [],
      });
      setFileList([]);
      setCccdFiles({ truoc: [], sau: [] });
    }
  }, [isNew, editingCustomer, loading, form]);

  const handleSave = async () => {
    const msgKey = "save_customer";
    try {
      const values = await form.validateFields();
      antMessage.loading({ content: "Đang xử lý...", key: msgKey }); // 1. Xử lý Upload Ảnh

      let finalAvatarUrl =
        fileList.length > 0 ? fileList[0].url || fileList[0].thumbUrl : null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        finalAvatarUrl = await uploadAvatar(fileList[0].originFileObj as File);
      } // (Tương tự cho CCCD - Tạm thời bỏ qua để giảm độ phức tạp)
      // 2. Tách Dữ liệu
      const customerData: CustomerFormData = {
        name: values.name,
        type: editingCustomerType,
        phone: values.phone?.replace(/\./g, ""), // Xóa dấu chấm
        email: values.email,
        address: values.address,
        dob: values.dob?.format("YYYY-MM-DD") || null,
        gender: values.gender,
        cccd: values.cccd,
        cccd_issue_date: values.cccd_issue_date?.format("YYYY-MM-DD") || null,
        avatar_url: finalAvatarUrl,
        cccd_front_url: null,
        cccd_back_url: null,
        occupation: values.occupation,
        lifestyle_habits: values.lifestyle_habits,
        allergies: values.allergies,
        medical_history: values.medical_history,
        tax_code: values.tax_code,
        contact_person_name: values.contact_person_name,
        contact_person_phone: values.contact_person_phone,
        loyalty_points: values.loyalty_points || 0,
        status: values.status || "active", // Đảm bảo status không bị null
      }; // Lọc ra chỉ ID và Quan hệ
      const guardiansData = (values.guardians || []).map((g: any) => ({
        guardian_id: g.guardian_id,
        relationship: g.relationship,
      }));

      if (isNew) {
        await createCustomer(customerData, guardiansData);
      } else {
        await updateCustomer(
          editingCustomer!.customer.id,
          customerData,
          guardiansData
        );
      } // Tự động quay về list (đã tích hợp trong store)
    } catch (error: any) {
      console.error("Lỗi Save:", error); // Store đã tự hiển thị message lỗi (nếu có ném lỗi)
      antMessage.error({
        content: `Lưu thất bại: ${error.message}`,
        key: msgKey,
      });
    }
  };

  const handleDelete = async (record: CustomerListRecord) => {
    antModal.confirm({
      title: `Ngừng Giao dịch khách "${record.name}"?`,
      content:
        "Hành động này sẽ đổi trạng thái sang 'Ngừng GD', không xóa vĩnh viễn.",
      okText: "Xác nhận",
      onOk: async () => {
        await deleteCustomer(record.id); // Đây là hàm xóa mềm
      },
    });
  };

  const handleReactivate = async (record: CustomerListRecord) => {
    try {
      await reactivateCustomer(record.id);
      antMessage.success(`Đã cho phép KH "${record.name}" giao dịch trở lại.`);
    } catch (error: any) {
      antMessage.error(error.message);
    }
  };

  // Hàm Xuất Excel
  const handleExportExcel = async () => {
    antMessage.loading({
      content: "Đang chuẩn bị dữ liệu xuất...",
      key: "export",
    });
    try {
      const dataToExport = await exportToExcel();

      if (dataToExport.length === 0) {
        antMessage.info({
          content: "Không có dữ liệu nào để xuất.",
          key: "export",
        });
        return;
      } // Tạo Bảng tính

      // [UPDATE] Format dữ liệu cho Template (Thêm cột Nợ đầu kỳ)
      const formattedData = dataToExport.map((item: any) => ({
        ...item,
        "Nợ Hiện Tại": item.current_debt || 0, // Cột mẫu để Import
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData); // Tạo Sổ làm việc
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachKhachHang"); // Xuất file
      XLSX.writeFile(
        wb,
        `DS_KhachHang_B2C_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      antMessage.success({
        content: `Đã xuất ${dataToExport.length} khách hàng.`,
        key: "export",
      });
    } catch (error: any) {
      antMessage.error({
        content: `Xuất file thất bại: ${error.message}`,
        key: "export",
      });
    }
  };

  //Hàm Nhập Danh sách khách hàng từ Excle
  const uploadProps: UploadProps = {
    name: "file",
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }: any) => {
      setIsImporting(true);
      antMessage.loading({
        content: "Đang xử lý file Excel...",
        key: "import",
      });
      try {
        const count = await importCustomers(file as File);
        if (onSuccess) onSuccess("ok");
        antMessage.success({
          content: `Import thành công! Đã thêm/cập nhật ${count} khách hàng.`,
          key: "import",
        }); // Store đã tự tải lại
      } catch (error: any) {
        if (onError) onError(error);
        antMessage.error({
          content: `Import thất bại: ${error.message}`,
          key: "import",
          duration: 5, // Cho 5 giây
        });
      } finally {
        setIsImporting(false);
      }
    },
  };

  const handleSelectGuardian = (guardian: CustomerListRecord) => {
    if (currentGuardianField === null) return;

    const currentGuardians = form.getFieldValue("guardians") || [];
    const updatedGuardians = currentGuardians.map((g: any, index: number) => {
      if (index === currentGuardianField) {
        return {
          ...g,
          guardian_id: guardian.id,
          name: guardian.name,
          phone: phoneFormatter(guardian.phone || undefined),
        };
      }
      return g; // SỬA LỖI LOGIC QUAN TRỌNG: (Không phải 'return;')
    });
    form.setFieldsValue({ guardians: updatedGuardians });
    antMessage.success(`Đã chọn: ${guardian.name}`);
    setIsGuardianModalOpen(false);
    setCurrentGuardianField(null); // Reset index
  };

  // --- GIAO DIỆN (Views) ---
  // 1. Giao diện Danh sách (List View)
  const renderListView = () => {
    // [NEW] XỬ LÝ KHI BẤM HEADER TABLE
    const handleTableChange = (
      _pagination: any,
      _filters: any,
      sorter: any
    ) => {
      // Reset sort debt nếu click cột khác, hoặc set giá trị nếu click cột nợ
      if (sorter.field === "current_debt") {
        const order =
          sorter.order === "ascend"
            ? "asc"
            : sorter.order === "descend"
              ? "desc"
              : null;
        fetchCustomers({}, order); // Gọi store fetch với sort mới
      } else {
        fetchCustomers({}, null); // Reset sort
      }
    };

    const columns: TableProps<CustomerListRecord>["columns"] = [
      {
        title: "Mã KH",
        dataIndex: "customer_code",
        key: "customer_code",
        width: 100,
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: "Tên Khách lẻ",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
        render: (text: string) => <Text>{text}</Text>,
      },
      {
        title: "Phân loại",
        dataIndex: "type",
        key: "type",
        width: 180,
        render: (type: CustomerB2CType) => (
          <Tag
            icon={type === "ToChuc" ? <TeamOutlined /> : <UserOutlined />}
            color={customerTypeMap[type]?.color}
          >
            {customerTypeMap[type]?.text}
          </Tag>
        ),
        filters: [
          { text: "Cá nhân", value: "CaNhan" },
          { text: "Tổ chức", value: "ToChuc" },
        ],
        onFilter: (value, record) => record.type === value,
      },
      {
        title: "SĐT",
        dataIndex: "phone",
        key: "phone",
        width: 120,
        render: (phone) => phoneFormatter(phone),
      },
      {
        title: "Điểm Tích lũy",
        dataIndex: "loyalty_points",
        key: "loyalty_points",
        width: 120,
        align: "center",
        render: (diem) =>
          diem > 0 ? <Tag color="gold">{diem} điểm</Tag> : "—",
      },
      // [NEW] CỘT NỢ HIỆN TẠI
      {
        title: "Nợ hiện tại",
        dataIndex: "current_debt",
        key: "current_debt",
        width: 150,
        align: "right",
        sorter: true, // Bật tính năng sort header của Antd
        render: (val: number) => (
          <span
            style={{
              color: val > 0 ? "#ff4d4f" : "#52c41a", // Đỏ nếu nợ > 0, Xanh nếu sạch
              fontWeight: val > 0 ? 600 : 400,
            }}
          >
            {new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(val || 0)}
          </span>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 120,
        align: "center",
        render: (status: CustomerStatus) => (
          <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
        ),
      },
      {
        title: "Hành động",
        key: "action",
        width: 100,
        align: "center",
        fixed: "right",
        render: (_: any, record: CustomerListRecord) => (
          <Space size="small">
            <Tooltip
              title={
                record.type === "CaNhan"
                  ? "Xem/Sửa Profile Bệnh nhân"
                  : "Xem/Sửa Profile Tổ chức"
              }
            >
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => {
                  if (record.type === "CaNhan") {
                    showFormView(record.type, record);
                  } else {
                    navigate(`/crm/organization/edit/${record.id}`);
                  }
                }}
              />
            </Tooltip>
            {/* SỬA LỖI: LOGIC 2 CHIỀU */}
            {record.status === "active" ? (
              <Access permission={PERMISSIONS.CRM.B2C.DELETE}>
                <Tooltip title="Ngừng Giao dịch">
                  <Popconfirm
                    title={`Ngừng GD khách "${record.name}"?`}
                    onConfirm={() => handleDelete(record)}
                    okText="Đồng ý"
                    cancelText="Hủy"
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>
              </Access>
            ) : (
              <Access permission={PERMISSIONS.CRM.B2C.EDIT}>
                <Tooltip title="Cho phép Giao dịch trở lại">
                  <Button
                    type="text"
                    style={{ color: "green" }}
                    icon={<SafetyOutlined />}
                    onClick={() => handleReactivate(record)}
                  />
                </Tooltip>
              </Access>
            )}
          </Space>
        ),
      },
    ];

    return (
      <Content style={{ padding: "0 12px" }}>
        <Card
          style={{ ...styles.card, margin: "0 12px 12px 12px" }}
          styles={{ body: { padding: "12px" } }}
        >
          <Spin spinning={loading} tip="Đang tải...">
            <Row
              justify="space-between"
              align="middle"
              style={{ marginBottom: "16px" }}
            >
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  Quản lý Khách lẻ (B2C)
                </Title>
              </Col>

              <Col>
                <Space>
                  <Upload {...uploadProps}>
                     
                    <Button icon={<UploadOutlined />} loading={isImporting}>
                          Nhập Excel  
                    </Button>
                  </Upload>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportExcel}
                  >
                    Xuất Excel
                  </Button>
                  <Button
                    type="primary"
                    icon={<TeamOutlined />}
                    onClick={() => navigate("/crm/organization/new")}
                  >
                    Thêm Khách (Tổ chức)
                  </Button>

                  <Button
                    type="primary"
                    icon={<UserOutlined />}
                    onClick={() => showFormView("CaNhan")}
                  >
                    Thêm Khách (Cá nhân)
                  </Button>
                </Space>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: "16px" }}>
              <Col flex="auto">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo Tên, SĐT, Mã KH (Kể cả SĐT Giám hộ)..."
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Col>

              <Col flex="200px">
                <Select
                  placeholder="Lọc theo Phân loại"
                  allowClear
                  style={{ width: "100%" }}
                  onChange={(val) => fetchCustomers({ type_filter: val })}
                >
                  <Option value="CaNhan">Cá nhân (Bệnh nhân)</Option>  
                  <Option value="ToChuc">Tổ chức (Mua lẻ)</Option>   
                </Select>
              </Col>
            </Row>
            <Table
              onChange={handleTableChange} // [NEW] Gắn hàm xử lý sort
              columns={columns}
              dataSource={customers}
              bordered
              rowKey="key"
              pagination={{
                current: page,
                pageSize: pageSize,
                total: totalCount,
                onChange: setPage, // <-- KẾT NỐI HÀM SETPAGE
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} của ${total} khách hàng`,
              }}
              scroll={{ x: 1000 }}
            />
          </Spin>
        </Card>
      </Content>
    );
  }; // 2. Giao diện Profile (Form View)
  const renderFormView = () => {
    // SỬA LỖI C: Thêm kiểu <CustomerHistory>
    const historyColumns: TableProps<CustomerHistory>["columns"] = [
      {
        title: "Ngày",
        dataIndex: "date",
        width: 120,
        render: (text: string) => dayjs(text).format("DD/MM/YYYY"),
      },
      { title: "Nội dung", dataIndex: "content", ellipsis: true },
      {
        title: "Giá trị",
        dataIndex: "cost",
        align: "right",
        render: (val: number) => `${val.toLocaleString()} đ`,
      },
    ]; // Xử lý upload (Giả lập)
    const handleUploadChange = (
      type: "avatar" | "cccd_truoc" | "cccd_sau",
      { fileList: newFileList }: any
    ) => {
      if (type === "avatar") {
        setFileList(newFileList);
      } else if (type === "cccd_truoc") {
        setCccdFiles({ ...cccdFiles, truoc: newFileList });
      } else if (type === "cccd_sau") {
        setCccdFiles({ ...cccdFiles, sau: newFileList });
      }
    };

    return (
      <Form form={form} layout="vertical" onFinish={handleSave}>
        {/* Thanh Affix */}
        <Affix offsetTop={40} style={{ zIndex: 10 }}>
          <Card
            style={{
              ...styles.card,
              margin: "0 8px",
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
            }} // SỬA LỖI B: Dùng styles.body
            styles={{ body: { padding: "12px 16px" } }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Button
                  type="primary"
                  icon={<ArrowLeftOutlined />}
                  onClick={showListView}
                >
                  Quay lại Danh sách
                </Button>
                <Divider type="vertical" />
                <Title level={4} style={{ margin: 0, display: "inline-block" }}>
                  {isNew
                    ? "Thêm Khách hàng (Cá nhân)"
                    : `Hồ sơ: ${form.getFieldValue("name") || "..."}`}
                </Title>
              </Col>

              <Col>
                <Access
                  permission={
                    isNew
                      ? PERMISSIONS.CRM.B2C.CREATE
                      : PERMISSIONS.CRM.B2C.EDIT
                  }
                  fallback={null} // Hide save button if no permission
                >
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={loading}
                  >
                    Lưu Hồ sơ
                  </Button>
                </Access>
              </Col>
            </Row>
          </Card>
        </Affix>
        {/* Nội dung Form - NÂNG CẤP: Dùng Tabs */}
        <Content style={{ padding: "10px", paddingTop: "0" }}>
          <Spin spinning={loading} tip="Đang tải...">
            <Card style={{ ...styles.card, margin: "0" }}>
              <Tabs defaultActiveKey="1">
                {/* TAB 1: Thông tin HCNS */}
                <TabPane
                  tab={
                    <Space>
                      <IdcardOutlined />
                      Thông tin HCNS
                    </Space>
                  }
                  key="1"
                >
                  <Row gutter={24}>
                    {/* Cột 1: Ảnh đại diện */}
                    <Col xs={24} md={8} lg={6} style={{ textAlign: "center" }}>
                      <Form.Item
                        label="Ảnh Đại diện"
                        style={{ textAlign: "center" }}
                      >
                        <Upload
                          action="#"
                          listType="picture-circle"
                          fileList={fileList}
                          maxCount={1}
                          beforeUpload={() => false}
                          onChange={(e) => handleUploadChange("avatar", e)}
                          onRemove={() => setFileList([])}
                          style={{ display: "flex", justifyContent: "center" }}
                        >
                          {fileList.length >= 1 ? null : (
                            <div>
                              <PlusOutlined />
                              <div style={{ marginTop: 0 }}>Tải ảnh</div>
                            </div>
                          )}
                        </Upload>
                      </Form.Item>

                      <Form.Item name="customer_code" label="Mã KH (Tự động)">
                        <Input placeholder="KH-00X" disabled />
                      </Form.Item>
                    </Col>
                    {/* Cột 2: Thông tin cá nhân & Pháp lý */}

                    <Col xs={24} md={16} lg={18}>
                      <Row gutter={16}>
                        {/* Dòng 1 */}
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="name"
                            label="Họ và Tên"
                            rules={[{ required: true }]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="phone"
                            label="SĐT (Liên hệ chính)"
                            tooltip="Nếu là trẻ em, SĐT là bắt buộc và là SĐT Giám hộ chính."
                          >
                            <Input
                              placeholder="Vd: 0965.637.788"
                              onChange={(e) => {
                                const { value } = e.target;
                                form.setFieldsValue({
                                  phone: phoneFormatter(value),
                                });
                              }}
                            />
                          </Form.Item>
                        </Col>
                        {/* Dòng 2 */}  
                        <Col xs={24} sm={8}>
                          <Form.Item name="dob" label="Ngày sinh">
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item label="Tuổi (Tự động)">
                            {/* SỬA LỖI: Dùng Form.Item dependencies để tự động cập nhật */}
                            <Form.Item noStyle dependencies={["dob"]}>
                              {({ getFieldValue }) => (
                                <Input
                                  value={calculateDetailedAge(
                                    getFieldValue("dob")
                                  )}
                                  disabled
                                  style={{
                                    color: "#0958d9",
                                    fontWeight: "bold",
                                  }}
                                />
                              )}
                            </Form.Item>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item name="gender" label="Giới tính">
                            <Radio.Group>
                              <Radio value="Nam">Nam</Radio>
                              <Radio value="Nữ">Nữ</Radio>
                              <Radio value="Khác">Khác</Radio>
                            </Radio.Group>
                          </Form.Item>
                        </Col>
                        {/* Dòng 3: Pháp lý */}
                        <Col xs={24} sm={8}>
                          <Form.Item name="cccd" label="Số Căn cước Công dân">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item
                            name="cccd_issue_date"
                            label="Ngày cấp CCCD"
                          >
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item
                            name="tinhTrangHonNhan"
                            label="Tình trạng Hôn nhân"
                          >
                            <Select
                              options={maritalStatusOptions}
                              placeholder="Chọn tình trạng..."
                            />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="address" label="Địa chỉ Thường trú">
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </TabPane>
                {/* TAB 2: Y TẾ & LỐI SỐNG */}
                <TabPane
                  tab={
                    <Space>
                      <MedicineBoxOutlined />Y tế & Lối sống
                    </Space>
                  }
                  key="2"
                >
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Title level={5} style={{ margin: 0 }}>
                        <SmileOutlined /> Bối cảnh & Lối sống
                      </Title>
                      <Divider style={{ marginTop: 8 }} />  
                      <Form.Item name="occupation" label="Nghề nghiệp">
                        <Input placeholder="Vd: Lái xe, Giáo viên, Kỹ sư IT..." />
                      </Form.Item>
                      <Form.Item
                        name="lifestyle_habits"
                        label="Thói quen sinh hoạt (Lối sống)"
                        tooltip="Giúp Dược sĩ tư vấn chính xác hơn."
                      >
                        <TextArea
                          rows={2}
                          placeholder="Vd: Hay thức khuya, hút thuốc, thích ăn cay, tập gym..."
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Title level={5} style={{ margin: 0 }}>
                        <MedicineBoxOutlined /> Thông tin Y tế (EMR)
                      </Title>

                      <Divider style={{ marginTop: 8 }} />
                      <Form.Item name="allergies" label="Dị ứng đã biết">
                        <TextArea
                          rows={2}
                          placeholder="Vd: Penicillin, Aspirin, Phấn hoa, Hải sản..."
                        />
                      </Form.Item>

                      <Form.Item
                        name="medical_history"
                        label="Bệnh nền / Mạn tính"
                      >
                        <TextArea
                          rows={2}
                          placeholder="Vd: Tăng huyết áp, Tiểu đường, Viêm mũi dị ứng..."
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </TabPane>
                {/* TAB 3: NGƯỜI GIÁM HỘ */}
                <TabPane
                  tab={
                    <Space>
                      <UsergroupAddOutlined />
                      Người Giám hộ
                    </Space>
                  }
                  key="3"
                >
                  <Paragraph type="secondary">
                    Thêm thông tin người giám hộ (Bố, Mẹ...) nếu khách hàng là
                    trẻ em. Sếp có thể tìm và liên kết với một hồ sơ khách hàng
                    đã tồn tại.
                  </Paragraph>

                  <Form.List name="guardians">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Card // SỬA LỖI 2 (Key): Dùng key từ Form.List (field.key)
                            key={key}
                            size="small"
                            style={styles.formListCard}
                            styles={{ body: { padding: "12px 16px" } }}
                            extra={
                              <Tooltip title="Xóa Người Giám hộ">
                                <Button
                                  type="text"
                                  danger
                                  icon={<MinusCircleOutlined />}
                                  onClick={() => remove(name)}
                                />
                              </Tooltip>
                            }
                          >
                            <Row gutter={16}>
                              <Col xs={24} md={10}>
                                {/* Trường Ẩn lưu ID */}  
                                <Form.Item
                                  {...restField}
                                  name={[name, "guardian_id"]}
                                  hidden
                                >
                                  <Input /> 
                                </Form.Item>
                                <Form.Item
                                  {...restField}
                                  name={[name, "name"]}
                                  label="Họ tên Người Giám hộ"
                                  rules={[
                                    {
                                      required: true,
                                      message: "Vui lòng chọn Giám hộ!",
                                    },
                                  ]}
                                >
                                  <Input
                                    readOnly
                                    placeholder="Bấm tìm kiếm để chọn..."
                                    suffix={
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<SearchOutlined />} // SỬA LỖI 2: Mở Modal và lưu index
                                        onClick={() => {
                                          setIsGuardianModalOpen(true);
                                          setCurrentGuardianField(name); // 'name' là index
                                        }}
                                      >
                                        Tìm KH
                                      </Button>
                                    }
                                  />
                                </Form.Item>
                              </Col>
                              <Col xs={12} md={7}>
                                <Form.Item
                                  {...restField}
                                  name={[name, "relationship"]} // SỬA LỖI D: Xóa fieldKey
                                  label="Mối quan hệ"
                                  rules={[{ required: true }]}
                                >
                                  <Select placeholder="Chọn...">
                                    <Option value="Bố">Bố</Option> 
                                    <Option value="Mẹ">Mẹ</Option> 
                                    <Option value="Ông">Ông</Option>
                                    <Option value="Bà">Bà</Option> 
                                    <Option value="Khác">Khác</Option>  
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col xs={12} md={7}>
                                <Form.Item
                                  {...restField}
                                  name={[name, "phone"]}
                                  // SỬA LỖI D: Xóa fieldKey
                                  label="Số điện thoại"
                                >
                                  <Input placeholder="SĐT Giám hộ" readOnly /> 
                                </Form.Item>
                                Note
                              </Col>
                            </Row>
                          </Card>
                        ))}

                        <Form.Item>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => add()} // SỬA LỖI B.3: AntD tự quản lý key
                            icon={<PlusOutlined />}
                          >
                            Thêm Người Giám hộ
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </TabPane>
                {/* TAB 4: LỊCH SỬ GIAO DỊCH */}  
                <TabPane
                  tab={
                    <Space>
                      <HistoryOutlined />
                      Lịch sử Giao dịch
                    </Space>
                  }
                  key="4"
                >
                  <Table
                    columns={historyColumns} // SỬA LỖI E: Dùng editingCustomer.history
                    dataSource={editingCustomer?.history || []}
                    size="small"
                    bordered
                    pagination={false}
                    rowKey="key"
                    locale={{
                      emptyText: (
                        <Empty description="Khách hàng chưa có lịch sử mua hàng/khám bệnh." />
                      ),
                    }}
                  />
                </TabPane>
              </Tabs>
            </Card>
          </Spin>
        </Content>
      </Form>
    );
  };

  return (
    <ConfigProvider locale={viVN}>
      {/* CSS (Giữ nguyên) */}  
      <style>{`
  .ant-table-thead > tr > th {
 border-bottom: 1.5px solid #d0d7de !important;
 background-color: #f6f8fa !important;
}
  .ant-upload-list-item-container {
 width: 100px !important;
height: 100px !important;
  }
  .ant-upload.ant-upload-select-picture-card {
  width: 100px !important;
  height: 100px !important;
  padding: 0 !important;
  margin: 0 !important;
  }
   `}</style>
      <PermissionGuard permission={PERMISSIONS.CRM.B2C.VIEW}>
        {/* SỬA LỖI G: Sửa style và logic view */}  
        <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
          {isFormView ? renderFormView() : renderListView()}  
        </Layout>
        {/* NÂNG CẤP: Modal Tìm kiếm Giám hộ */}  
        <GuardianSelectModal
          open={isGuardianModalOpen}
          onClose={() => setIsGuardianModalOpen(false)}
          onSelect={handleSelectGuardian}
        />
      </PermissionGuard>
    </ConfigProvider>
  );
};

// SỬA LỖI I: Sửa tên export
export default CustomerB2CPage;
