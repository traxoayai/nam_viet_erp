// src/pages/finance/AssetManagementPage.tsx (Mã nguồn hoàn chỉnh đã sửa lỗi)
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  DollarCircleOutlined,
  HomeOutlined,
  ToolOutlined,
  UserOutlined,
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
  InputNumber,
  App as AntApp,
  Tooltip,
  Popconfirm,
  Divider,
  Affix,
  DatePicker,
  Tabs,
  Empty,
  Upload,
  Radio,
  Spin,
} from "antd";
import dayjs from "dayjs";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { useUserStore } from "@/features/auth/stores/useUserStore";
import { uploadAssetImage } from "@/features/finance/api/assetService";
import { useAssetStore } from "@/features/finance/stores/useAssetStore";
import {
  AssetListRecord,
  AssetStatus,
  AssetFormData,
  MaintenancePlan,
  MaintenanceHistory,
  MaintenanceExecType,
} from "@/features/finance/types/asset";
import { useWarehouseStore } from "@/features/inventory/stores/warehouseStore";
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

// --- DỮ LIỆU TĨNH ---
const STATUS_MAP = {
  active: { text: "Đang sử dụng", color: "success" },
  storage: { text: "Trong kho", color: "default" },
  repair: { text: "Cần sửa chữa", color: "warning" },
  disposed: { text: "Đã thanh lý", color: "error" },
};
const MAINTENANCE_FREQUENCY = [
  { value: 1, label: "Hàng tháng" },
  { value: 3, label: "3 tháng / lần (Quý)" },
  { value: 6, label: "6 tháng / lần" },
  { value: 12, label: "Hàng năm" },
];

const AssetManagementPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage, modal: antModal } = AntApp.useApp();
  const [viewMode, setViewMode] = useState("list");
  const [isNew, setIsNew] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null); // Stores

  const {
    assets,
    assetTypes,
    currentAssetDetails,
    loading,
    loadingDetails,
    totalCount,
    fetchAssetTypes,
    fetchAssets,
    getAssetDetails,
    createAsset,
    updateAsset,
    deleteAsset,
  } = useAssetStore();
  const { warehouses, fetchWarehouses } = useWarehouseStore();
  const { suppliers, fetchSuppliers } = useSupplierStore();
  const { users, fetchUsers } = useUserStore(); // Local States

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [fileList, setFileList] = useState<any[]>([]); // --- HOOKS: Load dữ liệu chung và danh sách ---

  useEffect(() => {
    fetchAssetTypes();
    fetchWarehouses();
    fetchSuppliers();
    fetchUsers();
  }, []);

  const loadAssets = useCallback(() => {
    const filters = { search_query: debouncedSearch };
    fetchAssets(filters);
  }, [fetchAssets, debouncedSearch]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]); // --- HOOKS: Load chi tiết khi chuyển sang Form ---

  useEffect(() => {
    if (viewMode === "form" && editingAssetId) {
      getAssetDetails(editingAssetId);
    }
  }, [viewMode, editingAssetId, getAssetDetails]); // --- HOOKS: Điền Form khi có chi tiết ---

  useEffect(() => {
    if (editingAssetId && currentAssetDetails && !loadingDetails) {
      const asset = currentAssetDetails.asset;
      const initialValues = {
        ...asset,
        purchase_date: asset.purchase_date ? dayjs(asset.purchase_date) : null,
        handed_over_date: asset.handed_over_date
          ? dayjs(asset.handed_over_date)
          : null,
        asset_type_id: asset.asset_type_id || undefined,
        branch_id: asset.branch_id || undefined,
        user_id: asset.user_id || undefined,
        supplier_id: asset.supplier_id || undefined, // -- Các trường con
        enance_plans: (currentAssetDetails.maintenance_plans || []).map(
          (p) => ({
            ...p,
            key: uuidv4(),
          })
        ),
        maintenance_history: (
          currentAssetDetails.maintenance_history || []
        ).map((h) => ({
          ...h,
          maintenance_date: dayjs(h.maintenance_date),
        })),
      };
      form.setFieldsValue(initialValues); // Setup ảnh

      setFileList(
        asset.image_url
          ? [
              {
                uid: "-1",
                name: "ảnh.png",
                status: "done",
                url: asset.image_url,
              },
            ]
          : []
      );
    }
  }, [editingAssetId, currentAssetDetails, loadingDetails, form]); // --- HÀM TÍNH TOÁN (Logic Khấu hao) ---

  const calculateDepreciation = (changedValues: any, allValues: any) => {
    if (
      changedValues.cost !== undefined ||
      changedValues.depreciation_months !== undefined
    ) {
      const cost = allValues.cost || 0;
      const months = allValues.depreciation_months || 1;
      if (months > 0) {
        const perMonth = Math.round(cost / months);
        form.setFieldsValue({ depreciation_per_month: perMonth });
      }
    }
  }; // --- HÀM XỬ LÝ CHUYỂN ĐỔI FORM ---

  const showForm = (record: AssetListRecord | null = null) => {
    if (record) {
      setEditingAssetId(record.id);
      setIsNew(false);
    } else {
      setEditingAssetId(null);
      setIsNew(true);
      form.resetFields();
      form.setFieldsValue({
        status: "active" as AssetStatus,
        purchase_date: dayjs(),
        depreciation_months: 36,
        cost: 0, // CHIẾN LƯỢC MỚI: Set Kho Tổng (ID=1) và Loại TS (ID=1) là mặc định
        asset_type_id: assetTypes.length > 0 ? assetTypes[0].id : undefined, // Lấy ID của loại đầu tiên
        branch_id:
          warehouses.find((w) => w.key === "b2b")?.id ||
          warehouses[0]?.id ||
          undefined, // Kho B2B (nếu có key 'b2b')
        maintenance_plans: [
          {
            key: uuidv4(),
            exec_type: "internal" as MaintenanceExecType,
            content: "Kiểm tra, vệ sinh định kỳ",
            frequency_months: 6,
          },
        ],
        maintenance_history: [],
      });
      setFileList([]);
    }
    setViewMode("form");
  };

  const showList = () => {
    setViewMode("list");
    setEditingAssetId(null);
    loadAssets();
  }; // --- HÀM LƯU DỮ LIỆU CHÍNH ---

  const handleSave = async () => {
    const msgKey = "asset_save";
    try {
      const values = await form.validateFields();
      antMessage.loading({ content: "Đang xử lý...", key: msgKey }); // 1. Xử lý Ảnh
      let finalImageUrl = fileList.length > 0 ? fileList[0].url : null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        finalImageUrl = await uploadAssetImage(fileList[0].originFileObj);
      } // 2. Phân tách Dữ liệu
      const assetData: AssetFormData = {
        name: values.name,
        description: values.description,
        serial_number: values.serial_number,
        image_url: finalImageUrl,
        asset_type_id: values.asset_type_id,
        branch_id: values.branch_id,
        user_id: values.user_id,
        status: values.status,
        handed_over_date: values.handed_over_date?.format("YYYY-MM-DD") || null,
        purchase_date:
          values.purchase_date?.format("YYYY-MM-DD") ||
          dayjs().format("YYYY-MM-DD"),
        supplier_id: values.supplier_id,
        cost: values.cost,
        depreciation_months: values.depreciation_months,
      };
      const plans: MaintenancePlan[] = values.maintenance_plans || [];
      const history: MaintenanceHistory[] = (
        values.maintenance_history || []
      ).map((h: any) => ({
        ...h,
        maintenance_date: h.maintenance_date?.format("YYYY-MM-DD"),
      }));
      if (isNew) {
        await createAsset(assetData, plans, history);
        antMessage.success({
          content: `Thêm tài sản "${values.name}" thành công!`,
          key: msgKey,
        });
      } else {
        await updateAsset(editingAssetId!, assetData, plans, history);
        antMessage.success({
          content: `Cập nhật tài sản "${values.name}" thành công!`,
          key: msgKey,
        });
      }

      showList();
    } catch (error) {
      console.error("Lỗi Save:", error);
      antMessage.error({
        content: "Thao tác thất bại. Vui lòng kiểm tra dữ liệu.",
        key: msgKey,
      });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    antModal.confirm({
      title: `Xóa tài sản "${name}"?`,
      content: "Hành động này sẽ xóa vĩnh viễn tài sản và lịch sử liên quan.",
      okText: "Xóa vĩnh viễn",
      okType: "danger",
      onOk: async () => {
        const success = await deleteAsset(id);
        if (success) antMessage.success(`Đã xóa tài sản "${name}"`);
      },
      onCancel: () => antMessage.info("Đã hủy xóa."),
    });
  }; // --- HELPERS CHO RENDER ---

  const currencyFormatter = (value: number | string | undefined | null) => {
    if (value === null || value === undefined) return "0 đ";
    return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " đ";
  };
  const currencyParser = (value: string | undefined) => {
    return Number(value?.replace(/\đ\s?|(,*)/g, "") || 0);
  }; // --- CÁC CỘT CỦA BẢNG DANH SÁCH ---

  const columns = useMemo(
    () => [
      {
        title: "Mã TS",
        dataIndex: "asset_code",
        key: "asset_code",
        width: 100,
        fixed: "left" as const,
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: "Tên Tài sản",
        dataIndex: "name",
        key: "name",
        ellipsis: true,
        width: 250,
        fixed: "left" as const,
      },
      {
        title: "Loại",
        dataIndex: "asset_type_name",
        key: "asset_type_name",
        width: 150,
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: "Chi nhánh Phân bổ",
        dataIndex: "branch_name",
        key: "branch_name",
        width: 180,
        render: (text: string) => (
          <Tag icon={<HomeOutlined />} color="cyan">
            {text}
          </Tag>
        ),
      },
      {
        title: "Người sử dụng",
        dataIndex: "user_name",
        key: "user_name",
        width: 180,
        render: (text: string) => <Tag icon={<UserOutlined />}>{text}</Tag>,
      },
      {
        title: "Nguyên giá",
        dataIndex: "cost",
        key: "cost",
        width: 150,
        align: "right" as const,
        render: (value: number) => currencyFormatter(value),
      },
      {
        title: "Khấu hao / Tháng",
        dataIndex: "depreciation_per_month",
        key: "depreciation_per_month",
        width: 150,
        align: "right" as const,
        render: (value: number) => currencyFormatter(value),
      },
      {
        title: "Giá trị còn lại",
        dataIndex: "remaining_value",
        key: "remaining_value",
        width: 150,
        align: "right" as const,
        render: (value: number) => (
          <Text strong style={{ color: value > 0 ? "#0958d9" : "#cf1322" }}>
            {currencyFormatter(value)}
          </Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 120,
        align: "center" as const,
        render: (status: AssetStatus) => (
          <Tag color={STATUS_MAP[status].color}>{STATUS_MAP[status].text}</Tag>
        ),
      },
      {
        title: "Hành động",
        key: "action",
        width: 120,
        align: "center" as const,
        fixed: "right" as const,
        render: (_: any, record: AssetListRecord) => (
          <Space size="small">
                     
            <Tooltip title="Sửa chi tiết">
                         
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => showForm(record)}
              />
                       
            </Tooltip>
                     
            <Tooltip title="Xóa">
                         
              <Popconfirm
                title="Xóa tài sản này?"
                onConfirm={() => handleDelete(record.id, record.name)}
                okText="Xóa"
                cancelText="Hủy"
              >
                             
                <Button type="text" danger icon={<DeleteOutlined />} />         
                 
              </Popconfirm>
                       
            </Tooltip>
                   
          </Space>
        ),
      },
    ],
    [handleDelete]
  ); // --- RENDER SUB-COMPONENTS ---

  const renderListView = () => (
    <Card style={{ margin: "12px 0 0 0", border: "1.5px solid #d0d7de" }}>
             
      <Spin spinning={loading} tip="Đang tải dữ liệu...">
                 
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: "16px" }}
        >
                     
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              Quản lý Tài sản Cố định
            </Title>
          </Col>
                     
          <Col>
                         
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showForm(null)}
            >
              Thêm Tài sản Mới
            </Button>
                       
          </Col>
                   
        </Row>
                 
        <Row gutter={16} style={{ marginBottom: "16px" }}>
                     
          <Col flex="auto">
                         
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo Tên, Mã tài sản, Số Serial..."
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
                       
          </Col>
                     
          <Col flex="200px">
                         
            <Select
              placeholder="Loại tài sản"
              allowClear
              style={{ width: "100%" }}
              options={assetTypes.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(val) => fetchAssets({ asset_type_id: val })}
            />
                       
          </Col>
                     
          <Col flex="200px">
                         
            <Select
              placeholder="Trạng thái"
              allowClear
              style={{ width: "100%" }}
              options={Object.keys(STATUS_MAP).map((k) => ({
                value: k,
                label: STATUS_MAP[k as AssetStatus].text,
              }))}
              onChange={(val) => fetchAssets({ status: val })}
            />
                       
          </Col>
                   
        </Row>
                 
        <Table
          columns={columns}
          dataSource={assets}
          bordered
          rowKey="key"
          pagination={{ pageSize: 10, total: totalCount }}
          scroll={{ x: 1550 }}
        />
      </Spin>
             
    </Card>
  );
  const renderFormView = () => {
    // Hiển thị spinner ở Form View nếu đang tải chi tiết
    if (editingAssetId && loadingDetails) {
      return (
        <Spin
          tip="Đang tải chi tiết tài sản..."
          style={{ marginTop: 50, display: "block" }}
        />
      );
    }

    return (
      <Form
        form={form}
        layout="vertical"
        onValuesChange={calculateDepreciation}
        onFinish={handleSave}
      >
               
        <Affix offsetTop={40} style={{ zIndex: 10 }}>
                   
          <Card
            style={{
              margin: "0 12px",
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              border: "1.5px solid #d0d7de",
            }}
            bodyStyle={{ padding: "12px 16px" }}
          >
                       
            <Row justify="space-between" align="middle">
                           
              <Col>
                               
                <Button icon={<ArrowLeftOutlined />} onClick={showList}>
                  Quay lại Danh sách
                </Button>
                                <Divider type="vertical" />               
                <Title level={4} style={{ margin: 0, display: "inline-block" }}>
                                   
                  {isNew
                    ? "Thêm Tài sản Mới"
                    : `Sửa Tài sản: ${form.getFieldValue("name") || editingAssetId}`}
                                 
                </Title>
                             
              </Col>
                           
              <Col>
                               
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                                    Lưu Tài sản                
                </Button>
                             
              </Col>
                         
            </Row>
                     
          </Card>
                 
        </Affix>
                         
        <Card style={{ margin: "12px 0 0 0", border: "1.5px solid #d0d7de" }}>
                     
          <Tabs defaultActiveKey="1">
                          {/* Tab 1: Thông tin Chung */}             
            <TabPane
              tab={
                <Space>
                  <InfoCircleOutlined />
                  Thông tin Chung
                </Space>
              }
              key="1"
            >
                             
              <Row gutter={24}>
                                 
                <Col xs={24} md={8}>
                                     
                  <Form.Item label="Ảnh Tài sản">
                                         
                    <Upload
                      action="#"
                      listType="picture-card"
                      fileList={fileList}
                      maxCount={1}
                      beforeUpload={() => false}
                      onChange={({ fileList: newFileList }) =>
                        setFileList(newFileList)
                      }
                      onRemove={() => setFileList([])}
                    >
                                             
                      {fileList.length >= 1 ? null : (
                        <div>
                          <PlusOutlined />
                          <div style={{ marginTop: 8 }}>Tải ảnh lên</div>
                        </div>
                      )}
                                           
                    </Upload>
                                       
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={24} md={16}>
                                     
                  <Row gutter={24}>
                                         
                    <Col xs={24} md={16}>
                      <Form.Item
                        name="name"
                        label="Tên Tài sản"
                        rules={[
                          { required: true, message: "Vui lòng nhập tên!" },
                        ]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                                         
                    <Col xs={24} md={8}>
                      <Form.Item name="asset_code" label="Mã Tài sản (Tự động)">
                        <Input disabled />
                      </Form.Item>
                    </Col>
                                       
                  </Row>
                                     
                  <Row gutter={24}>
                                         
                    <Col xs={24} md={8}>
                                             
                      <Form.Item
                        name="asset_type_id"
                        label="Loại Tài sản"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn loại!",
                            type: "number",
                          },
                        ]}
                      >
                                                 
                        <Select
                          options={assetTypes.map((t) => ({
                            value: t.id,
                            label: t.name,
                          }))}
                          placeholder="Chọn loại tài sản"
                        />
                                               
                      </Form.Item>
                                           
                    </Col>
                                         
                    <Col xs={24} md={8}>
                                             
                      <Form.Item
                        name="status"
                        label="Trạng thái"
                        rules={[{ required: true }]}
                      >
                                                 
                        <Select placeholder="Chọn trạng thái">
                                                     
                          {Object.keys(STATUS_MAP).map((k) => (
                            <Option key={k} value={k}>
                              {STATUS_MAP[k as AssetStatus].text}
                            </Option>
                          ))}
                                                   
                        </Select>
                                               
                      </Form.Item>
                                           
                    </Col>
                                         
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="serial_number"
                        label="Số Serial (nếu có)"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                                       
                  </Row>
                                     
                  <Form.Item name="description" label="Mô tả / Ghi chú">
                    <TextArea rows={3} />
                  </Form.Item>
                                   
                </Col>
                               
              </Row>
                           
            </TabPane>
                                         {/* Tab 2: Tài chính & Khấu hao */}   
                     
            <TabPane
              tab={
                <Space>
                  <DollarCircleOutlined />
                  Tài chính & Khấu hao
                </Space>
              }
              key="2"
            >
                             
              <Row gutter={24}>
                                 
                <Col xs={12} md={8}>
                  <Form.Item
                    name="purchase_date"
                    label="Ngày Mua / Ghi tăng"
                    rules={[{ required: true }]}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item name="supplier_id" label="Nhà Cung cấp">
                                         
                    <Select
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      placeholder="Chọn nhà cung cấp"
                      allowClear
                    />
                                       
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item
                    name="cost"
                    label="Nguyên giá"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      formatter={currencyFormatter}
                      parser={currencyParser}
                      min={0}
                    />
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item
                    name="depreciation_months"
                    label="Thời gian Khấu hao (Tháng)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={1}
                      addonAfter="Tháng"
                    />
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item
                    name="depreciation_per_month"
                    label="Chi phí Khấu hao / Tháng (Tự tính)"
                    tooltip="= Nguyên giá / Thời gian Khấu hao"
                  >
                    <InputNumber
                      style={{ width: "100%", backgroundColor: "#f0f2f5" }}
                      formatter={currencyFormatter}
                      parser={currencyParser}
                      readOnly
                    />
                  </Form.Item>
                                   
                </Col>
                               
              </Row>
                           
            </TabPane>
                                         {/* Tab 3: Phân bổ & Sử dụng */}       
                 
            <TabPane
              tab={
                <Space>
                  <HomeOutlined />
                  Phân bổ & Sử dụng
                </Space>
              }
              key="3"
            >
                             
              <Row gutter={24}>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item
                    name="branch_id"
                    label="Chi nhánh Phân bổ"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn chi nhánh!",
                        type: "number",
                      },
                    ]}
                    tooltip="Chi phí khấu hao sẽ được tính vào P&L của chi nhánh này."
                  >
                                         
                    <Select
                      options={warehouses.map((w) => ({
                        value: w.id,
                        label: w.name,
                      }))}
                      placeholder="Chọn chi nhánh"
                    />
                                       
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item name="user_id" label="Người sử dụng/Quản lý">
                                         
                    <Select
                      options={users.map((u) => ({
                        value: u.key,
                        label: u.name || u.email,
                      }))}
                      placeholder="Chọn người dùng"
                      allowClear
                    />
                                       
                  </Form.Item>
                                   
                </Col>
                                 
                <Col xs={12} md={8}>
                                     
                  <Form.Item name="handed_over_date" label="Ngày Bàn giao">
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                                   
                </Col>
                               
              </Row>
                           
            </TabPane>
                                         {/* Tab 4: Bảo trì & Sửa chữa */}     
                   
            <TabPane
              tab={
                <Space>
                  <ToolOutlined />
                  Bảo trì & Sửa chữa
                </Space>
              }
              key="4"
              disabled={!editingAssetId}
            >
                              <Title level={5}>Kế hoạch Bảo trì Định kỳ</Title> 
                           
              <Paragraph type="secondary">
                Định nghĩa các "luật" bảo trì tự động. Hệ thống sẽ tự động tạo
                việc cho người phụ trách.
              </Paragraph>
                             
              <Form.List name="maintenance_plans">
                                 
                {(fields, { add, remove }) => (
                  <>
                                         
                    {fields.map((field) => (
                      <Card
                        key={field.key}
                        size="small"
                        style={{
                          border: "1.5px dashed #d0d7de",
                          marginBottom: 12,
                        }}
                        bodyStyle={{ padding: "12px 16px" }}
                        extra={
                          <Tooltip title="Xóa Kế hoạch">
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </Tooltip>
                        }
                      >
                                                 
                        <Row gutter={16}>
                          <Col xs={24} md={10}>
                            <Form.Item
                              {...field}
                              name={[field.name, "content"]}
                              label="Nội dung Bảo trì"
                              rules={[{ required: true }]}
                            >
                              <Input />
                            </Form.Item>
                          </Col>
                                                     
                          <Col xs={12} md={7}>
                            <Form.Item
                              {...field}
                              name={[field.name, "frequency_months"]}
                              label="Tần suất"
                              rules={[{ required: true }]}
                            >
                              <Select
                                options={MAINTENANCE_FREQUENCY}
                                placeholder="Chọn tần suất"
                              />
                            </Form.Item>
                          </Col>
                                                     
                          <Col xs={12} md={7}>
                            <Form.Item
                              {...field}
                              name={[field.name, "exec_type"]}
                              label="Đơn vị thực hiện"
                              initialValue="internal"
                              rules={[{ required: true }]}
                            >
                              <Radio.Group>
                                <Radio value="internal">Nội bộ</Radio>
                                <Radio value="external">Thuê ngoài</Radio>
                              </Radio.Group>
                            </Form.Item>
                          </Col>
                                                   
                        </Row>
                                                 
                        <Form.Item
                          noStyle
                          dependencies={[
                            ["maintenance_plans", field.name, "exec_type"],
                          ]}
                          //   shouldUpdate={(prev, curr) =>
                          //     prev.maintenance_plans?.[field.name]?.exec_type !==
                          //     curr.maintenance_plans?.[field.name]?.exec_type
                          //   }
                        >
                                                     
                          {({ getFieldValue }) => {
                            const type = getFieldValue([
                              "maintenance_plans",
                              field.name,
                              "exec_type",
                            ]);
                            if (type === "internal")
                              return (
                                <Form.Item
                                  {...field}
                                  name={[field.name, "assigned_user_id"]}
                                  label="Giao việc cho (Nội bộ)"
                                  rules={[{ required: true }]}
                                >
                                  <Select
                                    options={users.map((u) => ({
                                      value: u.key,
                                      label: u.name || u.email,
                                    }))}
                                    placeholder="Chọn nhân viên"
                                  />
                                </Form.Item>
                              );
                            if (type === "external")
                              return (
                                <Row gutter={16}>
                                  <Col xs={24} md={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, "provider_name"]}
                                      label="Tên ĐV Dịch vụ"
                                      rules={[{ required: true }]}
                                    >
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={12} md={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, "provider_phone"]}
                                      label="SĐT Liên hệ"
                                    >
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={12} md={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, "provider_note"]}
                                      label="Ghi chú"
                                    >
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              );
                            return null;
                          }}
                                                   
                        </Form.Item>
                                               
                      </Card>
                    ))}
                                         
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() =>
                          add({
                            exec_type: "internal" as MaintenanceExecType,
                            frequency_months: 6,
                          })
                        }
                        block
                        icon={<PlusOutlined />}
                      >
                        Thêm Kế hoạch Bảo trì
                      </Button>
                    </Form.Item>
                                     
                  </>
                )}
                               
              </Form.List>
                              <Divider />               
              <Title level={5}>Lịch sử Sửa chữa (Thực tế)</Title>               
              <Paragraph type="secondary">
                Ghi nhận các lần sửa chữa, hỏng hóc đột xuất đã diễn ra.
              </Paragraph>
                             
              <Form.List name="maintenance_history">
                                 
                {(fields, { add, remove }) => (
                  <>
                    <Button
                      icon={<PlusOutlined />}
                      style={{ marginBottom: 16 }}
                      onClick={() => add({ maintenance_date: dayjs() })}
                    >
                      Thêm Ghi nhận Sửa chữa
                    </Button>
                                         
                    {fields.length === 0 ? (
                      <Empty description="Chưa có lịch sử sửa chữa." />
                    ) : (
                      <Table
                        columns={[
                          {
                            title: "Ngày Sửa",
                            key: "date",
                            width: 150,
                            render: (_, record) => (
                              <Form.Item
                                {...record}
                                name={[record.name, "maintenance_date"]}
                                rules={[{ required: true }]}
                              >
                                <DatePicker size="small" format="DD/MM/YYYY" />
                              </Form.Item>
                            ),
                          },
                          {
                            title: "Nội dung",
                            key: "content",
                            ellipsis: true,
                            render: (_, record) => (
                              <Form.Item
                                {...record}
                                name={[record.name, "content"]}
                                rules={[{ required: true }]}
                              >
                                <Input size="small" />
                              </Form.Item>
                            ),
                          },
                          {
                            title: "Chi phí",
                            key: "cost",
                            width: 150,
                            align: "right" as const,
                            render: (_, record) => (
                              <Form.Item
                                {...record}
                                name={[record.name, "cost"]}
                                initialValue={0}
                                rules={[{ required: true }]}
                              >
                                <InputNumber
                                  size="small"
                                  style={{ width: "100%" }}
                                  formatter={currencyFormatter}
                                  parser={currencyParser}
                                  min={0}
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            title: "Xóa",
                            key: "delete",
                            width: 70,
                            align: "center" as const,
                            render: (_, record) => (
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(record.name)}
                              />
                            ),
                          },
                        ]}
                        dataSource={fields}
                        bordered
                        size="small"
                        rowKey="key"
                        pagination={false}
                      />
                    )}
                                       
                  </>
                )}
              </Form.List>
            </TabPane>
                       
          </Tabs>
                   
        </Card>
                     
      </Form>
    );
  };

  return (
    <Spin spinning={false}>
           
      <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
                {viewMode === "list" ? renderListView() : renderFormView()}     
      </Layout>
         
    </Spin>
  );
};

export default AssetManagementPage;
