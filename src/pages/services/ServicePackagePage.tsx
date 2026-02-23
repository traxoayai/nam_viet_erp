// src/pages/services/ServicePackagePage.tsx
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  GiftOutlined,
  SettingOutlined,
  MinusCircleOutlined,
  HomeOutlined,
  AccountBookOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Button,
  Table,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Form,
  message,
  Divider,
  Affix,
  Radio,
  InputNumber,
  Popconfirm,
  DatePicker,
  ConfigProvider,
  Empty,
  Tooltip,
  Badge,
  // Dropdown, // Unused
  Alert,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useState, useEffect } from "react";

// Import Stores & Components
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect"; // <-- MỚI: Component dùng chung
import { useServicePackageStore } from "@/features/marketing/stores/useServicePackageStore";
import { useWarehouseStore } from "@/features/inventory/stores/warehouseStore"; // <-- MỚI: Store kho
import { ServicePackageRecord } from "@/features/marketing/types/servicePackage";

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const styles = {
  layout: { minHeight: "100vh", backgroundColor: "#f6f8fa" },
  card: {
    border: "1px solid #d0d7de",
    borderRadius: "6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  headerCard: {
    border: "1px solid #d0d7de",
    borderTop: 0,
    borderRadius: "0 0 6px 6px",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
  },
};

const currencyFormatter = (value: any) =>
  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";

const currencyParser = (value: string | undefined) =>
  value ? value.replace(/\$\s?|(,*)/g, "") : "";

const ServicePackagePage: React.FC = () => {
  const {
    packages,
    loading,
    viewMode,
    editingPackage,
    totalCount,
    fetchPackages,
    createPackage,
    updatePackage,
    deletePackage,
    showForm,
    showList,
    deletePackages, // [NEW] - Bulk Delete
    updateStatus, // [NEW] - Bulk Update Status
  } = useServicePackageStore();

  // Lấy danh sách Kho thật từ Store Warehouse
  const { warehouses, fetchWarehouses } = useWarehouseStore();

  const [form] = Form.useForm();
  const [formType, setFormType] = useState<"service" | "bundle">("service");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined
  );

  // Load danh sách Gói & Kho khi trang được mount
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]); // [NEW] State cho rowSelection
  useEffect(() => {
    fetchPackages({
      search_query: searchKeyword,
      type_filter: typeFilter,
      status_filter: statusFilter,
    });
    fetchWarehouses(); // <-- Fix Lỗi 3: Tải dữ liệu kho thật
  }, [searchKeyword, typeFilter, statusFilter]);

  // Load dữ liệu vào Form khi Edit
  useEffect(() => {
    if (viewMode === "form") {
      if (editingPackage) {
        const pkgData = editingPackage.package_data;
        const items = editingPackage.package_items;

        setFormType((pkgData.type as any) || "service");
        const itemsField =
          pkgData.type === "bundle" ? "packageItems" : "consumables";

        form.setFieldsValue({
          ...pkgData,
          sku: pkgData.sku,
          validDates: [dayjs(pkgData.valid_from), dayjs(pkgData.valid_to)],
          // Fix Lỗi 3: Chuyển đổi mảng ID kho (number/string) sang string cho Select mode multiple
          applicableBranches: (pkgData.applicable_branches || []).map(String),
          applicableChannels: pkgData.applicable_channels || "all",
          clinicalCategory: pkgData.clinical_category || "none", // Map từ DB (snake_case) ra UI (camelCase)
          [itemsField]: items.map((i: any) => ({
            ...i,
            id: i.item_id,
            unitPrice: 0,
            scheduleDays: i.schedule_days || 0,
          })),
        });
      } else {
        setFormType("service");
        form.resetFields();
        form.setFieldsValue({
          status: "active",
          type: "service",
          unit: "Lần",
          consumables: [],
          packageItems: [],
          validDates: [dayjs(), dayjs().add(1, "year")],
          applicableChannels: "all",
          applicableBranches: [],
          clinicalCategory: "none",
          revenueAccountId: "5111",
          price: 0,
          totalCostPrice: 0,
          discountPercent: 0,
          validityDays: 365,
        });
      }
    }
  }, [viewMode, editingPackage, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const itemsRaw =
        values.type === "bundle" ? values.packageItems : values.consumables;
      const items = (itemsRaw || []).map((i: any) => ({
        item_id: i.id,
        quantity: i.quantity,
        item_type: "product",
        schedule_days: i.scheduleDays || 0,
      }));

      const payload = {
        ...values,
        sku: values.sku,
        validFrom: values.validDates?.[0]?.toISOString(),
        validTo: values.validDates?.[1]?.toISOString(),
        applicableChannels: values.applicableChannels || "all",
        // Fix Lỗi 3: Đảm bảo gửi mảng ID kho lên server
        applicableBranches: values.applicableBranches || [],
        clinicalCategory: values.clinicalCategory || "none",
        validityDays: values.validityDays || null,
      };

      delete payload.validDates;
      delete payload.consumables;
      delete payload.packageItems;
      delete payload.totalCostPrice;
      delete payload.discountPercent;

      let success = false;
      if (editingPackage) {
        success = await updatePackage(
          editingPackage.package_data.id,
          payload,
          items
        );
      } else {
        success = await createPackage(payload, items);
      }

      if (success) showList();
    } catch (error) {
      console.error(error);
      message.error("Vui lòng kiểm tra lại các trường thông tin!");
    }
  };

  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.type) {
      setFormType(changedValues.type);
      form.setFieldsValue({
        unit: changedValues.type === "service" ? "Lần" : "Gói",
      });
    }

    const items = allValues.consumables || allValues.packageItems || [];
    let totalCost = 0;
    let totalRetail = 0;

    items.forEach((item: any) => {
      if (item?.quantity && item?.unitPrice) {
        totalCost += item.unitPrice * item.quantity;
        totalRetail += item.unitPrice * 1.3 * item.quantity;
      }
    });

    form.setFieldValue("totalCostPrice", totalCost);

    const salePrice = allValues.price || 0;
    if (totalRetail > 0 && salePrice > 0 && salePrice < totalRetail) {
      const discount = ((totalRetail - salePrice) / totalRetail) * 100;
      form.setFieldValue("discountPercent", discount.toFixed(1));
    } else {
      form.setFieldValue("discountPercent", 0);
    }
  };

  // --- RENDER VIEW ---

  const renderListView = () => {
    const columns = [
      {
        title: "Mã & Tên",
        dataIndex: "sku",
        render: (sku: string, record: ServicePackageRecord) => (
          <Space direction="vertical" size={0}>
            <Text strong>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {sku}
            </Text>
          </Space>
        ),
      },
      {
        title: "Loại",
        dataIndex: "type",
        width: 120,
        align: "center" as const,
        render: (type: string) =>
          type === "service" ? (
            <Tag icon={<SettingOutlined />} color="blue">
              Dịch vụ
            </Tag>
          ) : (
            <Tag icon={<GiftOutlined />} color="purple">
              Gói Combo
            </Tag>
          ),
      },
      {
        title: "Phân loại Y tế",
        dataIndex: "clinical_category",
        width: 130,
        render: (cat: string) => {
          if (cat === "lab") return <Tag color="blue">Xét nghiệm</Tag>;
          if (cat === "imaging") return <Tag color="purple">CĐHA</Tag>;
          if (cat === "procedure") return <Tag color="orange">Thủ thuật</Tag>;
          if (cat === "examination") return <Tag color="green">Khám bệnh</Tag>;
          if (cat === "vaccination") return <Tag color="magenta">Tiêm chủng</Tag>;
          return <Text type="secondary">-</Text>;
        }
      },
      {
        title: "Giá Bán",
        dataIndex: "price",
        align: "right" as const,
        render: (val: number) => (
          <Text strong style={{ color: "#0958d9" }}>
            {currencyFormatter(val)} ₫
          </Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        align: "center" as const,
        width: 120,
        render: (st: string) =>
          st === "active" ? (
            <Badge status="success" text="Đang KD" />
          ) : (
            <Badge status="default" text="Ngừng KD" />
          ),
      },
      {
        title: "Hành động",
        key: "actions",
        width: 100,
        render: (_: any, record: ServicePackageRecord) => (
          <Space>
            <Tooltip title="Chỉnh sửa">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => showForm(record)}
              />
            </Tooltip>
            <Popconfirm title="Xóa?" onConfirm={() => deletePackage(record.id)}>
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Content
        style={{
          padding: "24px",
          maxWidth: 1800,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Card style={styles.card} bordered={false} bodyStyle={{ padding: 0 }}>
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              📦 Quản lý Gói & Dịch vụ
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showForm()}
            >
              Thêm mới
            </Button>
          </div>

          <div
            style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0" }}
          >
            <Row gutter={16}>
              <Col flex="auto">
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm theo Tên, Mã SKU..."
                  allowClear
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </Col>
              <Col flex="200px">
                <Select
                  placeholder="Loại"
                  allowClear
                  style={{ width: "100%" }}
                  onChange={(val) => setTypeFilter(val)}
                >
                  <Select.Option value="service">Dịch vụ</Select.Option>
                  <Select.Option value="bundle">Gói Combo</Select.Option>
                </Select>
              </Col>
              <Col flex="200px">
                <Select
                  placeholder="Trạng thái"
                  allowClear
                  style={{ width: "100%" }}
                  onChange={(val) => setStatusFilter(val)}
                >
                  <Select.Option value="active">Hiệu lực</Select.Option>
                  <Select.Option value="inactive">Ẩn</Select.Option>
                </Select>
              </Col>
            </Row>
          </div>

          {/* [NEW] Thanh Hành động Hàng loạt */}
          {selectedRowKeys.length > 0 && (
            <Alert
              message={`${selectedRowKeys.length} gói dịch vụ được chọn`}
              type="info"
              showIcon
              style={{ margin: "0 24px 16px" }}
              action={
                <Space>
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                        updateStatus(selectedRowKeys as number[], "active");
                        setSelectedRowKeys([]);
                    }}
                  >
                    Kích hoạt
                  </Button>
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    danger
                    onClick={() => {
                        updateStatus(selectedRowKeys as number[], "inactive");
                        setSelectedRowKeys([]);
                    }}
                  >
                    Ngừng kinh doanh
                  </Button>
                  <Popconfirm
                    title="Xóa các gói đã chọn?"
                    description="Hành động này không thể hoàn tác!"
                    onConfirm={() => {
                        deletePackages(selectedRowKeys as number[]);
                        setSelectedRowKeys([]);
                    }}
                    okText="Xóa vĩnh viễn"
                    okType="danger"
                  >
                    <Button size="small" type="primary" danger icon={<DeleteOutlined />}>
                      Xóa ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                </Space>
              }
            />
          )}

          <Table
            dataSource={packages}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, total: totalCount }}
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }} // [NEW] Enable selection
          />
        </Card>
      </Content>
    );
  };

  // 2. Form View
  const renderFormView = () => {
    // Component con để xử lý logic thêm hàng trong form
    const ItemsTableEditor = ({ listName }: { listName: string }) => {
      // State để clear ô tìm kiếm sau khi chọn
      const [selectValue, setSelectValue] = useState<any>(null);

      return (
        <Form.List name={listName}>
          {(fields, { add, remove }) => (
            <>
              {/* COMPONENT DÙNG CHUNG - FIX LỖI 1: Thêm value={selectValue} */}
              <DebounceProductSelect
                style={{ width: "100%", marginBottom: 16 }}
                searchTypes={typesToSearch}
                value={selectValue}
                onChange={(_, option: any) => {
                  // --- BẮT ĐẦU ĐOẠN SỬA ---
                  // Kiểm tra an toàn: Nếu không có option hoặc product thì dừng ngay
                  if (!option || !option.product) {
                    console.warn("Không lấy được thông tin sản phẩm từ option");
                    return;
                  }
                  const product = option.product;
                  // --- KẾT THÚC ĐOẠN SỬA ---

                  const currentItems = form.getFieldValue(listName) || [];

                  const existingIndex = currentItems.findIndex(
                    (i: any) => i.id === product.id
                  );

                  if (existingIndex >= 0) {
                    const currentQty =
                      currentItems[existingIndex].quantity || 0;
                    form.setFieldValue(
                      [listName, existingIndex, "quantity"],
                      currentQty + 1
                    );
                    message.success(`Đã tăng số lượng: ${product.name}`);
                  } else {
                    const newItem = {
                      id: product.id,
                      name: product.name,
                      unit: product.retail_unit || product.unit, // Fallback unit
                      quantity: 1,
                      unitPrice: product.actual_cost || product.price || 0, // Fallback price
                      scheduleDays: 0,
                    };
                    add(newItem);
                    message.success(`Đã thêm: ${product.name}`);
                  }

                  setTimeout(() => {
                    handleFormValuesChange({}, form.getFieldsValue());
                  }, 0);

                  setSelectValue(null);
                }}
              />

              {/* Bọc Table trong Form.Item noStyle dependencies để auto-render khi list thay đổi */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev[listName] !== curr[listName]}
              >
                {() => (
                  <Table
                    dataSource={fields.map((f) => ({
                      ...form.getFieldValue(listName)[f.name],
                      key: f.key,
                      index: f.name,
                    }))}
                    pagination={false}
                    size="small"
                    bordered
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Chưa có vật tư/dịch vụ nào"
                        />
                      ),
                    }}
                    columns={[
                      { title: "Tên", dataIndex: "name" },
                      { title: "ĐVT", dataIndex: "unit", width: 80 },
                      {
                        title: "Số lượng",
                        dataIndex: "quantity",
                        width: 120,
                        render: (_, record) => (
                          <Form.Item
                            name={[record.index, "quantity"]}
                            noStyle
                            rules={[{ required: true, message: "Nhập SL" }]}
                          >
                            <InputNumber
                              min={1}
                              style={{ width: "100%" }}
                              onChange={() =>
                                handleFormValuesChange(
                                  {},
                                  form.getFieldsValue()
                                )
                              }
                            />
                          </Form.Item>
                        ),
                      },
                      // Cột Nhắc lịch (Chỉ hiện cho Gói Bundle)
                      ...(listName === "packageItems"
                        ? [
                            {
                              title: "Nhắc lịch (Ngày)",
                              dataIndex: "scheduleDays",
                              width: 140,
                              render: (_: any, record: any) => (
                                <Form.Item
                                  name={[record.index, "scheduleDays"]}
                                  noStyle
                                >
                                  <InputNumber
                                    min={0}
                                    addonAfter="Ngày"
                                    style={{ width: "100%" }}
                                  />
                                </Form.Item>
                              ),
                            },
                          ]
                        : []),
                      {
                        title: "Đơn giá vốn",
                        dataIndex: "unitPrice",
                        width: 150,
                        align: "right",
                        render: (val) => currencyFormatter(val),
                      },
                      {
                        title: "",
                        width: 50,
                        render: (_, record) => (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<MinusCircleOutlined />}
                            onClick={() => {
                              remove(record.index);
                              // Tính lại giá sau khi xóa
                              setTimeout(
                                () =>
                                  handleFormValuesChange(
                                    {},
                                    form.getFieldsValue()
                                  ),
                                0
                              );
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                )}
              </Form.Item>
            </>
          )}
        </Form.List>
      );
    };
    // LOGIC MỚI: Xác định loại cần tìm dựa trên formType
    // Nếu là 'service' (Tạo dịch vụ lẻ) -> Cần tìm Vật tư tiêu hao (Product) để tính giá vốn
    // Nếu là 'bundle' (Tạo gói) -> Cần tìm Dịch vụ con (Service) hoặc Sản phẩm (Product) để bán kèm
    const typesToSearch = formType === 'service' ? ['product'] : ['service', 'product'];

    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={handleFormValuesChange}
      >
        <Affix offsetTop={0} style={{ zIndex: 99 }}>
          <div style={{ padding: "12px 24px", ...styles.headerCard }}>
            <Row
              justify="space-between"
              align="middle"
              style={{ maxWidth: 1200, margin: "0 auto" }}
            >
              <Col>
                <Space>
                  <Button icon={<ArrowLeftOutlined />} onClick={showList}>
                    Quay lại
                  </Button>
                  <Divider type="vertical" />
                  <Title level={5} style={{ margin: 0 }}>
                    {editingPackage
                      ? `Cập nhật: ${editingPackage.package_data.name}`
                      : "Tạo Gói/Dịch vụ Mới"}
                  </Title>
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={loading}
                >
                  Lưu thay đổi
                </Button>
              </Col>
            </Row>
          </div>
        </Affix>

        <Content style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
          <Card
            title="Thông tin chung"
            style={{ ...styles.card, marginBottom: 24 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="type" label="Loại hình kinh doanh">
                  <Radio.Group buttonStyle="solid" disabled={!!editingPackage}>
                    <Radio.Button value="service">Dịch vụ (Khám/Lẻ)</Radio.Button>
                    <Radio.Button value="bundle">
                      Gói Combo (Dùng nhiều lần)
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item 
                  name="clinicalCategory" 
                  label="Phân loại Y tế (Cho Bác sĩ)" 
                  initialValue="none"
                  tooltip="Phân loại này giúp Bác sĩ tìm kiếm đúng nhóm dịch vụ khi khám bệnh."
                >
                  <Select>
                    <Select.Option value="none">Không áp dụng (Bán lẻ)</Select.Option>
                    <Select.Option value="examination">Khám bệnh</Select.Option>
                    <Select.Option value="lab">Xét nghiệm</Select.Option>
                    <Select.Option value="imaging">CĐHA (Siêu âm/XQ...)</Select.Option>
                    <Select.Option value="procedure">Thủ thuật</Select.Option>
                    <Select.Option value="vaccination">Tiêm chủng</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Tên hiển thị"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Vd: Khám Nhi tổng quát" />
                </Form.Item>
              </Col>
              <Col span={6}>
                {/* FIX LỖI A: Dùng name="sku" */}
                <Form.Item
                  name="sku"
                  label="Mã (SKU)"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="AUTO..." />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="unit" label="Đơn vị tính" initialValue="Lần">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="validDates"
                  label="Thời gian mở bán"
                  rules={[{ required: true }]}
                >
                  <RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="status"
                  label="Trạng thái"
                  initialValue="active"
                >
                  <Select>
                    <Select.Option value="active">
                      🟢 Đang kinh doanh
                    </Select.Option>
                    <Select.Option value="inactive">
                      ⚪ Ngừng kinh doanh
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card
            title="Cấu hình Giá & Vật tư"
            style={{ ...styles.card, marginBottom: 24 }}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="price"
                  label="Giá bán niêm yết"
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    formatter={(v) => currencyFormatter(v)}
                    parser={(v) => currencyParser(v) as any}
                    addonAfter="₫"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="totalCostPrice"
                  label="Tổng giá vốn (Ước tính)"
                >
                  <InputNumber
                    style={{ width: "100%", backgroundColor: "#f0f2f5" }}
                    readOnly
                    formatter={(v) => currencyFormatter(v)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="discountPercent" label="% Chiết khấu">
                  <InputNumber
                    style={{ width: "100%", backgroundColor: "#f0f2f5" }}
                    readOnly
                    addonAfter="%"
                  />
                </Form.Item>
              </Col>

              {/* Fix Lỗi 4: Thêm hạn sử dụng gói */}
              {formType === "bundle" && (
                <Col span={24}>
                  <Form.Item
                    name="validityDays"
                    label={
                      <Space>
                        <ClockCircleOutlined /> Hạn sử dụng Gói (Tính từ ngày
                        mua)
                      </Space>
                    }
                    rules={[{ required: true }]}
                    tooltip="Sau số ngày này, các dịch vụ chưa dùng trong gói sẽ hết hạn."
                  >
                    <InputNumber
                      style={{ width: "200px" }}
                      min={1}
                      addonAfter="Ngày"
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>

            <Divider orientation="left" style={{ fontSize: 14 }}>
              {formType === "service"
                ? "Vật tư tiêu hao (Tự động trừ kho)"
                : "Dịch vụ/Sản phẩm trong Gói (Có nhắc lịch)"}
            </Divider>

            <ItemsTableEditor
              listName={formType === "service" ? "consumables" : "packageItems"}
            />
          </Card>

          <Card title="Kế toán & Phạm vi" style={styles.card}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="revenueAccountId"
                  label={
                    <Space>
                      <AccountBookOutlined /> Tài khoản ghi nhận doanh thu
                    </Space>
                  }
                >
                  <Select placeholder="Chọn tài khoản kế toán...">
                    <Select.Option value="5111">
                      5111 - Doanh thu bán hàng
                    </Select.Option>
                    <Select.Option value="5113">
                      5113 - Doanh thu dịch vụ
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="applicableBranches"
                  label={
                    <Space>
                      <HomeOutlined /> Chi nhánh áp dụng
                    </Space>
                  }
                  initialValue={[]}
                >
                  <Select
                    mode="multiple"
                    placeholder="Chọn chi nhánh (Để trống = Toàn hệ thống)"
                    options={warehouses.map((w) => ({
                      value: String(w.id),
                      label: w.name,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="applicableChannels"
                  label="Kênh bán"
                  initialValue="all"
                >
                  <Radio.Group>
                    <Radio value="all">Tất cả</Radio>
                    <Radio value="pos">Tại quầy (POS)</Radio>
                    <Radio value="online">Online</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Content>
      </Form>
    );
  };

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={styles.layout}>
        {viewMode === "list" ? renderListView() : renderFormView()}
      </Layout>
    </ConfigProvider>
  );
};

export default ServicePackagePage;
