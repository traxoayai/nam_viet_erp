// src/pages/crm/CustomerB2BPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  TeamOutlined,
  IdcardOutlined,
  CreditCardOutlined,
  HistoryOutlined,
  DownloadOutlined,
  UploadOutlined,
  MinusCircleOutlined,
  EnvironmentOutlined,
  AimOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import {
  Layout,
  UploadProps,
  Input,
  Alert,
  Table,
  Button,
  message,
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
  Spin,
  ConfigProvider,
  Divider,
  Affix,
  Tabs,
  Empty,
  InputNumber,
  Upload,
  Checkbox,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx"; // Import Excel

import type { TableProps, TabsProps } from "antd";
// import type { UploadRequestOption } from "antd/es/upload/interface";

// IMPORT "BỘ NÃO" VÀ "KHUÔN MẪU"
import { useDebounce } from "@/shared/hooks/useDebounce";
import { uploadLicense } from "@/features/sales/api/customerB2BService"; // Service B2B
import { useCustomerB2BStore } from "@/features/sales/stores/useCustomerB2BStore"; // Store B2B
import { useUserStore } from "@/features/auth/stores/useUserStore"; // Store Users (cho NVKD)
import { CustomerStatus } from "@/features/sales/types/customer"; // Lấy Status từ B2C
import {
  CustomerB2BListRecord,
  CustomerB2BFormData,
  //   CustomerB2BContact,
  TransactionHistory,
} from "@/features/sales/types/customerB2B";

const { Content } = Layout;
const { Title, Text } = Typography;
// const { Option } = Select;
const { TextArea } = Input;

// --- CSS INLINE (Style từ Canvas) ---
const styles = {
  card: {
    margin: "8px", // Giảm margin
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
  formListCard: {
    border: "1.5px dashed #d0d7de",
    backgroundColor: "#fcfcfc",
    marginBottom: 12,
  },
};

// --- HÀM HỖ TRỢ (Từ Canvas) ---
const currencyFormatter = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return "0 đ";
  return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " đ";
};
const currencyParser = (value: string | undefined) => {
  if (!value) return "0";
  return value.replace(/\đ\s?|(,*)/g, "");
};

// Định dạng số điện thoại
const phoneFormatter = (value: string | undefined) => {
  if (!value) return "";
  const phoneNumber = value.replace(/[^\d]/g, "");
  const match = phoneNumber.match(/^(\d{0,4})(\d{0,3})(\d{0,3})$/);
  if (!match) return phoneNumber;
  return [match[1], match[2], match[3]].filter(Boolean).join(".");
};

// --- DỮ LIỆU TĨNH ---
const statusMap = {
  active: { text: "Đang GD", color: "success" },
  inactive: { text: "Ngừng GD", color: "default" },
};
const paymentTermsOptions = [
  { value: 0, label: "Thanh toán ngay (0 ngày)" },
  { value: 30, label: "Công nợ 30 ngày" },
  { value: 60, label: "Công nợ 60 ngày" },
  { value: 90, label: "Công nợ 90 ngày" },
];

// --- COMPONENT CHÍNH ---
const CustomerB2BPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage, modal: antModal } = AntApp.useApp(); // Lấy state từ "bộ não" B2B
  const {
    customers,
    loading,
    loadingDetails,
    isFormView,
    editingCustomer,
    totalCount,
    page,
    pageSize,
    fetchCustomers,
    // getCustomerDetails,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    reactivateCustomer,
    exportToExcel,
    importCustomers,
    setPage,
    showListView,
    showFormView, // importCustomers, (Sẽ làm sau)
    // exportToExcel, (Sẽ làm sau)
  } = useCustomerB2BStore(); // Lấy NVKD từ UserStore

  const { users, fetchUsers } = useUserStore(); // State cục bộ
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  //   const [isImporting, setIsImporting] = useState(false);
  const [licenseFileList, setLicenseFileList] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const isNew = !editingCustomer && isFormView; // Tải NVKD (chỉ 1 lần)

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]); // Tải danh sách khách hàng B2B
  const loadCustomers = useCallback(() => {
    fetchCustomers({ search_query: debouncedSearch });
  }, [fetchCustomers, debouncedSearch]);

  useEffect(() => {
    // Chỉ tải khi ở List View
    if (!isFormView) {
      loadCustomers();
    }
  }, [isFormView, loadCustomers]); // Điền form khi dữ liệu Sửa về

  useEffect(() => {
    if (!isNew && editingCustomer && !loadingDetails) {
      const customer = editingCustomer.customer;
      const initialValues = {
        ...customer,
        lat: customer.gps_lat, // Tách GPS
        long: customer.gps_long, // Tách GPS
        contacts: (editingCustomer.contacts || []).map((c) => ({
          ...c,
          key: uuidv4(),
        })),
        history: (editingCustomer.history || []).map((h) => ({
          ...h,
          key: uuidv4(),
        })),
      };
      form.setFieldsValue(initialValues); // Setup file GPKD (nếu có)
      setLicenseFileList(
        customer.business_license_url
          ? [
              {
                uid: "-1",
                name: "gpkd.pdf",
                status: "done",
                url: customer.business_license_url,
              },
            ]
          : []
      );
    } else if (isNew) {
      form.resetFields();
      form.setFieldsValue({
        status: "active",
        payment_term: 30,
        debt_limit: 100000000,
        contacts: [],
        history: [],
      });
      setLicenseFileList([]);
    }
  }, [isNew, editingCustomer, loadingDetails, form]); // Lọc NVKD (sales staff) từ danh sách Users

  const salesStaffOptions = useMemo(() => {
    // (Tạm thời lấy 5 user đầu tiên, Sếp sẽ nâng cấp Role sau)
    return users.slice(0, 5).map((user) => ({
      value: user.key, // UUID
      label: user.name || user.email,
    }));
  }, [users]);

  const handleSave = async () => {
    const msgKey = "save_customer_b2b";
    try {
      const values = await form.validateFields();
      antMessage.loading({ content: "Đang xử lý...", key: msgKey }); // 1. Xử lý Upload File (GPKD)

      let finalLicenseUrl =
        licenseFileList.length > 0
          ? licenseFileList[0].url || licenseFileList[0].thumbUrl
          : null;
      if (licenseFileList.length > 0 && licenseFileList[0].originFileObj) {
        finalLicenseUrl = await uploadLicense(
          licenseFileList[0].originFileObj as File
        );
      } // 2. Tách Dữ liệu

      const customerData: Partial<CustomerB2BFormData> = {
        name: values.name,
        tax_code: values.tax_code,
        debt_limit: values.debt_limit,
        payment_term: values.payment_term,
        ranking: values.ranking,
        business_license_number: values.business_license_number,
        business_license_url: finalLicenseUrl,
        sales_staff_id: values.sales_staff_id,
        status: values.status || "active",
        phone: values.phone,
        email: values.email,
        vat_address: values.vat_address,
        shipping_address: values.shipping_address,
        gps_lat: values.lat,
        gps_long: values.long,
        bank_name: values.bank_name,
        bank_account_name: values.bank_account_name,
        bank_account_number: values.bank_account_number,
      };
      const contactsData = (values.contacts || []).map((c: any) => ({
        name: c.name,
        position: c.position,
        phone: c.phone,
        email: c.email,
      }));

      if (isNew) {
        await createCustomer(customerData, contactsData);
      } else {
        await updateCustomer(
          editingCustomer!.customer.id,
          customerData,
          contactsData
        );
      }
      antMessage.success({ content: "Lưu hồ sơ B2B thành công!", key: msgKey });
    } catch (error: any) {
      console.error("Lỗi Save B2B:", error);
      antMessage.error({
        content: `Lưu thất bại: ${error.message}`,
        key: msgKey,
      });
    }
  };

  const handleDelete = (record: CustomerB2BListRecord) => {
    antModal.confirm({
      title: `Ngừng Giao dịch khách "${record.name}"?`,
      onOk: async () => {
        try {
          await deleteCustomer(record.id);
          antMessage.success("Đã cập nhật trạng thái.");
        } catch (error: any) {
          antMessage.error(error.message);
        }
      },
    });
  };

  // Hàm chuyển sang trạng thái "Đang Giao Dịch"
  const handleReactivate = (record: CustomerB2BListRecord) => {
    try {
      reactivateCustomer(record.id);
      antMessage.success(`Đã cho phép KH "${record.name}" giao dịch lại.`);
    } catch (error: any) {
      antMessage.error(error.message);
    }
  };

  //Xuất Excel
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
      }

      // [UPDATE] Format dữ liệu cho Template (Thêm cột Nợ đầu kỳ)
      const formattedData = dataToExport.map((item: any) => ({
          ...item,
          // Thêm cột này để làm mẫu cho người dùng nhập liệu (Import lại)
          "Nợ Hiện Tại": item.current_debt || 0, 
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachKhachHangB2B");
      XLSX.writeFile(
        wb,
        `DS_KhachHang_B2B_${new Date().toISOString().split("T")[0]}.xlsx`
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

  // --- HÀNH ĐỘNG HÀNG LOẠT ---
  const onSelectChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };
  const hasSelected = selectedRowKeys.length > 0; // Hàm xử lý hàng loạt

  const handleBulkAction = async (action: "delete" | "reactivate") => {
    const actionText =
      action === "delete" ? "Ngừng Giao dịch" : "Kích hoạt lại";
    const rpcAction = action === "delete" ? deleteCustomer : reactivateCustomer;

    antModal.confirm({
      title: `Xác nhận ${actionText} Hàng loạt`,
      content: `Sếp có chắc muốn ${actionText.toLowerCase()} ${selectedRowKeys.length} khách hàng đã chọn?`,
      okText: "Xác nhận",
      onOk: async () => {
        const msgKey = "bulk_action";
        antMessage.loading({ content: "Đang xử lý...", key: msgKey });
        try {
          for (const key of selectedRowKeys) {
            await rpcAction(Number(key)); // Gọi RPC cho từng key
          }
          antMessage.success({
            content: `Đã ${actionText} ${selectedRowKeys.length} khách hàng.`,
            key: msgKey,
          });
          setSelectedRowKeys([]); // Xóa chọn
          loadCustomers(); // Tải lại
        } catch (error: any) {
          antMessage.error({
            content: `Thất bại: ${error.message}`,
            key: msgKey,
          });
        }
      },
    });
  };

  // Nhập Ds khách hàng từ Excel
  const uploadProps: UploadProps = {
    name: "file",
    showUploadList: false, // SỬA LỖI: Gán kiểu 'any' cho các tham số
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
        });
      } catch (error: any) {
        if (onError) onError(error);
        antMessage.error({
          content: `Import thất bại: ${error.message}`,
          key: "import",
          duration: 5,
        });
      } finally {
        setIsImporting(false);
      }
    },
  };

  // Giả lập lấy GPS (Từ Canvas)
  const handleGetGPS = () => {
    const diaChi = form.getFieldValue("shipping_address");
    if (!diaChi) {
      antMessage.warning("Sếp cần nhập Địa chỉ Giao hàng trước!");
      return;
    }
    antMessage.loading({ content: "Đang tìm tọa độ GPS...", key: "gps" });
    setTimeout(() => {
      const newLat = (21.0118 + Math.random() * 0.01).toFixed(6);
      const newLong = (105.8226 + Math.random() * 0.01).toFixed(6);
      form.setFieldsValue({ lat: newLat, long: newLong });
      message.success({ content: "Đã lấy tọa độ GPS thành công!", key: "gps" });
    }, 1000);
  }; // Copy địa chỉ (Từ Canvas)
  const handleCopyAddress = (e: any) => {
    if (e.target.checked) {
      const diaChiVAT = form.getFieldValue("vat_address");
      form.setFieldsValue({ shipping_address: diaChiVAT });
    }
  };
  const handleUploadChange = ({ fileList: newFileList }: any) => {
    setLicenseFileList(newFileList);
  }; // --- GIAO DIỆN (Views) ---
  // 1. Giao diện Danh sách (List View)

  const renderListView = () => {
    const columns: TableProps<CustomerB2BListRecord>["columns"] = [
      {
        title: "Mã KH (B2B)",
        dataIndex: "customer_code",
        key: "customer_code",
        width: 120,
        render: (text) => <Text strong>{text}</Text>,
      },
      {
        title: "Tên Công ty/Tổ chức",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
        render: (text, record) => (
          <Space direction="vertical" size={0}>
            <Text strong>{text}</Text>  
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.phone}
            </Text>
          </Space>
        ),
      },
      {
        title: "Người Phụ trách",
        dataIndex: "sales_staff_name",
        key: "sales_staff_name",
        width: 180,
        render: (name) => name || <Text type="secondary">Chưa gán</Text>,
      },
      {
        title: "Nợ Hiện tại",
        dataIndex: "current_debt",
        key: "current_debt",
        width: 150,
        align: "right",
        render: (no) => (
          <Text strong style={{ color: no > 0 ? "#cf1322" : "#595959" }}>
            {currencyFormatter(no)}
          </Text>
        ),
      },
      {
        title: "Hạn mức Nợ",
        dataIndex: "debt_limit",
        key: "debt_limit",
        width: 150,
        align: "right",
        render: (limit) => (
          <Text type="secondary">{currencyFormatter(limit)}</Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 100,
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
        render: (_: any, record: CustomerB2BListRecord) => (
          <Space size="small">
            <Tooltip title="Xem/Sửa Hồ sơ B2B">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => showFormView(record)}
              />
            </Tooltip>
            {record.status === "active" ? (
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
            ) : (
              <Tooltip title="Cho phép Giao dịch trở lại">
                <Button
                  type="text"
                  style={{ color: "green" }}
                  icon={<SafetyOutlined />}
                  onClick={() => handleReactivate(record)}
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ];

    return (
      <Content style={{ padding: "0 8px" }}>
        <Card style={styles.card} styles={{ body: { padding: "16px" } }}>
          <Spin spinning={loading} tip="Đang tải...">
            <Row
              justify="space-between"
              align="middle"
              style={{ marginBottom: "16px" }}
            >
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  Quản lý Khách B2B (Bán buôn)
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
                    onClick={() => showFormView()}
                  >
                    Thêm Khách B2B Mới
                  </Button>
                </Space>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: "16px" }}>
              <Col flex="auto">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo Tên, SĐT, Mã KH, MST..."
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Col>
              <Col flex="200px">
                <Select
                  placeholder="Lọc theo NV Phụ trách"
                  allowClear
                  style={{ width: "100%" }}
                  options={salesStaffOptions}
                  onChange={(val) =>
                    fetchCustomers({ sales_staff_filter: val })
                  }
                />
              </Col>
            </Row>
            {/* --- THANH HÀNH ĐỘNG HÀNG LOẠT --- */}    
            {hasSelected ? (
              <Alert
                message={`${selectedRowKeys.length} khách hàng được chọn`}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                action={
                  <Space>
                    <Button
                      size="small"
                      onClick={() => handleBulkAction("reactivate")}
                    >
                        <SafetyOutlined /> Giao dịch lại
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleBulkAction("delete")}
                    >
                        <DeleteOutlined /> Ngừng Giao dịch
                    </Button>
                       
                  </Space>
                }
              />
            ) : null}
                {/* --- KẾT THÚC THANH HÀNH ĐỘNG --- */}
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={customers}
              bordered
              rowKey="key"
              pagination={{
                current: page,
                pageSize: pageSize,
                total: totalCount,
                onChange: setPage,
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
  }; // 2. Giao diện Profile B2B (Form View)
  const renderFormView = () => {
    const historyColumns: TableProps<TransactionHistory>["columns"] = [
      {
        title: "Ngày",
        dataIndex: "date",
        width: 120,
        render: (text: string) => dayjs(text).format("DD/MM/YYYY"),
      },
      { title: "Mã C.Từ", dataIndex: "code", width: 100 },
      { title: "Nội dung", dataIndex: "content", ellipsis: true },
      {
        title: "Giá trị",
        dataIndex: "total",
        align: "right",
        render: (val: number) => (
          <Text type={val > 0 ? "success" : "danger"}>
            {currencyFormatter(val)}
          </Text>
        ),
      },
    ];

    // SỬA LỖI A: Chuyển Tabs sang 'items'
    const tabItems: TabsProps["items"] = [
      {
        key: "1",
        label: (
          <Space>
            <IdcardOutlined />
            Thông tin Chung & Liên hệ
          </Space>
        ),
        children: (
          <>
            <Title level={5}>Thông tin Pháp lý & Hóa đơn</Title>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Tên Công ty/Tổ chức"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Vd: Công ty Dược Hậu Giang" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="tax_code" label="Mã số thuế (Nếu có)">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                 
                <Form.Item name="phone" label="SĐT Bàn Tổ chức (Chính)">
                  <Input
                    placeholder="Vd: 024.123.456"
                    onChange={(e) => {
                      const { value } = e.target;
                      form.setFieldsValue({
                        phone: phoneFormatter(value),
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="business_license_number"
                  label="Giấy phép Kinh doanh Dược"
                >
                  <Input placeholder="Vd: GPKD-12345" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="File Giấy phép KD (PDF/Ảnh)">
                  <Upload
                    maxCount={1}
                    fileList={licenseFileList}
                    action="#"
                    beforeUpload={() => false}
                    onChange={handleUploadChange}
                    onRemove={() => setLicenseFileList([])}
                  >
                    <Button icon={<UploadOutlined />}>Tải File</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="vat_address"
                  label="Địa chỉ Xuất Hóa Đơn VAT (Trên Giấy phép KD)"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng nhập địa chỉ xuất hóa đơn!",
                    },
                  ]}
                >
                  <TextArea rows={2} />
                </Form.Item>
              </Col>
            </Row>

            <Divider
              style={{ borderTopWidth: "2px", borderTopColor: "#406e9cff" }}
            />

            <Title level={5}>Người Liên hệ</Title>
            <Form.List name="contacts">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      style={styles.formListCard}
                      styles={{ body: { padding: "12px 16px" } }} // SỬA LỖI B.2
                      extra={
                        <Tooltip title="Xóa Người liên hệ">
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
                        <Col xs={24} md={8}>
                          <Form.Item
                            {...restField}
                            name={[name, "name"]}
                            label="Họ tên"
                            rules={[{ required: true }]}
                          >
                            <Input placeholder="Vd: Chị Lan" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            {...restField}
                            name={[name, "position"]}
                            label="Vị trí/Chức vụ"
                            rules={[{ required: true }]}
                          >
                            <Input placeholder="Vd: Kế toán, Mua hàng..." />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            {...restField}
                            name={[name, "phone"]}
                            label="SĐT/Email"
                            rules={[{ required: true }]}
                          >
                            <Input placeholder="SĐT hoặc Email liên hệ" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Form.Item>
                    <Button
                      type="primary"
                      onClick={() => add()}
                      icon={<PlusOutlined />}
                    >
                      Thêm Người Liên hệ
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
            <Divider
              style={{ borderTopWidth: "2px", borderTopColor: "#406e9cff" }}
            />
            <Title level={5}>Thông tin Giao hàng (Logistics)</Title>
            <Form.Item
              name="shipping_address"
              label="Địa chỉ Giao hàng"
              rules={[{ required: true }]}
            >
              <TextArea
                rows={2}
                placeholder="Nhập địa chỉ chi tiết để lấy GPS..."
              />
            </Form.Item>
            <Checkbox
              onChange={handleCopyAddress}
              style={{ marginTop: -12, marginBottom: 16 }}
            >
              <Text type="secondary">Giống Địa chỉ Xuất Hóa đơn VAT</Text>
            </Checkbox>

            <Card size="small" styles={{ body: { padding: "12px 16px" } }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Tooltip
                    color="#c5fde3ff"
                    title="Dùng để tối ưu tuyến đường giao hàng cho NV Giao vận."
                  >
                    <Text strong>
                      <EnvironmentOutlined /> Tọa độ GPS (Để tối ưu Giao vận)
                    </Text>
                  </Tooltip>
                </Col>
                <Col span={8}>
                  <Form.Item name="lat" label="Vĩ độ (Lat)">
                    <Input placeholder="21.0118" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="long" label="Kinh độ (Long)">
                    <Input placeholder="105.8226" />
                  </Form.Item>
                </Col>
                <Col
                  span={8}
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    paddingBottom: "24px",
                  }}
                >
                  <Button
                    type="primary"
                    icon={<AimOutlined />}
                    onClick={handleGetGPS}
                    style={{ width: "50%" }}
                  >
                    Lấy GPS
                  </Button>
                </Col>
              </Row>
            </Card>
          </>
        ),
      },
      {
        key: "2",
        label: (
          <Space>
            <CreditCardOutlined />
            Tài chính & Công nợ
          </Space>
        ),
        children: (
          <>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Title level={5}>Chính sách Bán hàng & Quản trị</Title>
                <Form.Item
                  name="sales_staff_id"
                  label="Nhân viên Phụ trách"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={salesStaffOptions}
                    placeholder="Chọn NVKD/CSKH"
                  />
                </Form.Item>
                <Form.Item name="ranking" label="Xếp loại Khách hàng">
                  <Select
                    options={[
                      { value: "Kim Cương", label: "Kim Cương" },
                      { value: "VIP", label: "VIP" },
                      { value: "Thành viên", label: "Thành viên" },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="status" label="Trạng thái">
                  <Select
                    options={[
                      { value: "active", label: "Đang giao dịch" },
                      { value: "inactive", label: "Ngừng giao dịch" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Title level={5}>Điều khoản Công nợ</Title>
                <Form.Item
                  name="debt_limit"
                  label="Hạn mức Công nợ (Tối đa)"
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    formatter={currencyFormatter}
                    parser={currencyParser}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item name="payment_term" label="Điều khoản Thanh toán">
                  <Select options={paymentTermsOptions} />
                </Form.Item>
                <Text type="secondary">
                  Nợ hiện tại:
                  <Text strong style={{ color: "#cf1322" }}>
                    {currencyFormatter(
                      editingCustomer?.customer.current_debt || 0
                    )}
                  </Text>
                </Text>
              </Col>
            </Row>
            <Divider
              style={{ borderTopWidth: "2px", borderTopColor: "#406e9cff" }}
            />
            <Title level={5}>Thông tin Ngân hàng (Của Khách)</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="bank_name" label="Tên Ngân hàng">
                  <Input placeholder="Vd: Vietcombank" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="bank_account_number" label="Số Tài khoản">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="bank_account_name" label="Tên Chủ tài khoản">
                  <Input placeholder="Vd: CT CP DUOC HAU GIANG" />
                </Form.Item>
              </Col>
            </Row>
          </>
        ),
      },
      {
        key: "3",
        label: (
          <Space>
            <HistoryOutlined />
            Lịch sử Giao dịch
          </Space>
        ),
        children: (
          <Table
            columns={historyColumns}
            dataSource={editingCustomer?.history || []}
            size="small"
            bordered
            pagination={false}
            rowKey="key"
            locale={{
              emptyText: (
                <Empty description="Khách hàng chưa có lịch sử giao dịch." />
              ),
            }}
          />
        ),
      },
    ];

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
            }}
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
                <Divider
                  type="vertical"
                  style={{ borderTopWidth: "2px", borderTopColor: "#406e9cff" }}
                />
                <Title level={4} style={{ margin: 0, display: "inline-block" }}>
                  {isNew
                    ? "Thêm Khách hàng (B2B)"
                    : `Hồ sơ: ${form.getFieldValue("name") || "..."}`}
                </Title>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={loading || loadingDetails}
                >
                  Lưu Hồ sơ
                </Button>
              </Col>
            </Row>
          </Card>
        </Affix>

        {/* Nội dung Form */}
        <Content style={{ padding: "0 8px" }}>
          <Spin spinning={loading || loadingDetails} tip="Đang tải...">
            <Card style={{ ...styles.card, margin: "8px 0 0 0" }}>
              <Tabs defaultActiveKey="1" items={tabItems} />
            </Card>
          </Spin>
        </Content>
      </Form>
    );
  };

  return (
    <ConfigProvider locale={viVN}>
      {/* CSS cho Table Header */}  
      <style>{`
  .ant-table-thead > tr > th {
  border-bottom: 1.5px solid #d0d7de !important;
    background-color: #f6f8fa !important;
  }
   `}</style>
      <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
        {isFormView ? renderFormView() : renderListView()}  
      </Layout>
    </ConfigProvider>
  );
};

export default CustomerB2BPage;
