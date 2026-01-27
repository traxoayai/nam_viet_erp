// src/pages/inventory/transfer/ProductFormPage.tsx

import {
  UploadOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  ContainerOutlined,
  TruckOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  // FilePdfOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  ScanOutlined,
  MedicineBoxOutlined, 
  GlobalOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Select,
  Button,
  Card,
  Typography,
  Row,
  Col,
  ConfigProvider,
  Space,
  InputNumber,
  Upload,
  Divider,
  Affix,
  Form,
  Image,
  Spin,
  Tabs,
  App as AntApp,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState } from "react"; // [NEW] useState
import { ProductAiScannerModal } from "@/features/product/components/ProductAiScannerModal"; // [NEW]
import { aiService } from "@/features/product/api/aiService"; // [NEW]



import SupplierSelectModal from "@/shared/ui/common/SupplierSelectModal";
import { useProductFormLogic } from "./hooks/useProductFormLogic";
import { Access } from "@/shared/components/auth/Access"; // [NEW]
import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const ProductFormPage: React.FC = () => {
  const { message: antMessage } = AntApp.useApp();
  // [NEW] AI Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const {
    form,
    loading,
    loadingDetails,
    isEditing,
    currentProduct,
    imageUrl,
    setImageUrl,
    fileList,
    handleUpload,
    onUploadChange,
    handleImageSearch,
    isSupplierModalOpen,
    setIsSupplierModalOpen,
    selectedSupplierName,
    setSelectedSupplierName,
    warehouses,
    onFinish,
    handleModifyCostOrMargin,
    navigate,
    anchorUnitName, // Dynamic Label
  } = useProductFormLogic();

  const handleCancel = () => {
    navigate("/inventory");
  };

  // [NEW] Xử lý khi AI điền form
  const handleAiFill = (aiData: any) => {
    const mappedData = aiService.mapAiDataToForm(aiData);
    form.setFieldsValue(mappedData);
    antMessage.success("Đã điền thông tin từ AI!");
    // Có thể cần setup thêm ảnh nếu có
  };

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={{ minHeight: "100vh", backgroundColor: "#efededff" }}>
        <Spin
          spinning={loading || loadingDetails}
          tip={loading ? "Đang xử lý..." : "Đang tải dữ liệu..."}
        >
          <Content style={{ padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Title level={4} style={{ margin: 0 }}>
                {isEditing
                  ? `Chỉnh sửa: ${currentProduct?.name || "Sản phẩm"}`
                  : "Thêm Sản phẩm mới"}
              </Title>
              <Button 
                icon={<ScanOutlined />} 
                onClick={() => setIsScannerOpen(true)}
                type="dashed"
              >
                Scan Tài liệu (AI)
              </Button>
            </div>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
            >
              <Tabs 
                defaultActiveKey="1" 
                type="card"
                items={[
                  // TAB 1: THÔNG TIN CHUNG
                  {
                    key: "1",
                    label: <span><AppstoreOutlined /> Thông tin chung</span>,
                    children: (
                      <>
                        <Card
                          title={
                            <Space>
                              <InfoCircleOutlined /> Thông tin Cơ bản
                            </Space>
                          }
                          bordered={false}
                          style={{ marginBottom: 24 }}
                        >
                          <Access permission={PERMISSIONS.INVENTORY.EDIT_INFO}>
                            <Row gutter={24}>
                            <Col xs={24} md={6}>
                              <Form.Item label="Ảnh sản phẩm">
                                <Upload
                                  listType="picture-card"
                                  fileList={fileList}
                                  onChange={onUploadChange}
                                  customRequest={handleUpload}
                                  maxCount={1}
                                >
                                  {fileList.length === 0 && (
                                    <div>
                                      <UploadOutlined /> <div>Tải ảnh lên</div>
                                    </div>
                                  )}
                                </Upload>
                                <Input
                                  placeholder="URL ảnh..."
                                  value={imageUrl}
                                  onChange={(e) => setImageUrl(e.target.value)}
                                  addonAfter={
                                    <Button
                                      type="text"
                                      icon={<SearchOutlined />}
                                      onClick={handleImageSearch}
                                    >
                                      Tìm
                                    </Button>
                                  }
                                  style={{ marginTop: 8 }}
                                />
                                {imageUrl && !fileList.length ? (
                                  <Image
                                    width={102}
                                    height={102}
                                    src={imageUrl}
                                    fallback="error"
                                    style={{
                                      marginTop: 8,
                                      border: "1px dashed #d9d9d9",
                                      padding: 4,
                                      borderRadius: 8,
                                    }}
                                  />
                                ) : null}
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={18}>
                              <Row gutter={16}>
                                <Col xs={24} lg={12}>
                                  <Form.Item
                                    name="productName"
                                    label="Tên sản phẩm"
                                    rules={[{ required: true }]}
                                  >
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                  <Form.Item name="sku" label="Mã SKU">
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={6}>
                                  <Form.Item name="barcode" label="Mã vạch">
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item name="category" label="Phân loại SP">
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item name="manufacturer" label="Công ty Sản xuất">
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item label="Công ty Phân phối (NCC)">
                                    <Access permission={PERMISSIONS.INVENTORY.MANAGE_SUPPLIER}>
                                        <Input
                                        placeholder="Chọn nhà cung cấp..."
                                        value={selectedSupplierName}
                                        onClick={() => setIsSupplierModalOpen(true)}
                                        readOnly
                                        addonAfter={<SearchOutlined />}
                                        style={{ cursor: "pointer" }}
                                        />
                                    </Access>
                                  </Form.Item>
                                  <Form.Item name="distributor" hidden>
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item name="registrationNumber" label="Số Đăng ký">
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item name="packingSpec" label="Quy cách (Text)">
                                    <Input placeholder="Hộp 10 vỉ..." />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} sm={12} lg={8}>
                                  <Form.Item name="tags" label="Hoạt chất chính">
                                    <Input />
                                  </Form.Item>
                                </Col>
                              </Row>
                            </Col>
                          </Row>
                          </Access>
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: -1 }}>
                             {/* Hacky way? Better to wrap Inputs. Let's wrap the Col content or FieldSet */}
                          </div>
                          {/* [NEW] Protect Edit Info */}
                          <div style={{ display: 'none' }}></div> 
                          {/* Access wrapper for inputs is hard with Form.Item structure requiring direct child. 
                              I will wrap the card content logically or use a FieldSet if possible. 
                              For now, I will wrap the individual inputs where critical.
                              User said "Bọc nhóm input". I will wrap the Row content inside Access disabled.
                          */}
                        </Card>

                        <Card
                          title={
                            <Space>
                              <DollarOutlined /> Giá & Kinh Doanh
                            </Space>
                          }
                          bordered={false}
                          style={{ marginBottom: 24 }}
                        >
                          <Row gutter={16}>
                            {/* ROW 1: PRICING INPUTS (4 Cols) */}
                            <Col xs={24} sm={12} md={8} lg={6}>
                              <Form.Item name="invoicePrice" label="Giá nhập HĐ">
                                <InputNumber
                                  style={{ width: "100%" }}
                                  formatter={(v) =>
                                    `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                  }
                                  parser={(v) => v!.replace(/đ\s?|(,*)/g, "")}
                                  addonAfter="đ"
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={24} sm={12} md={8} lg={6}>
                              <Form.Item
                                name="actualCost"
                                label={`Giá Vốn (theo ${anchorUnitName})*`}
                                rules={[{ required: true }]}
                                initialValue={0}
                                tooltip="Nhập giá vốn của đơn vị Bán buôn (ví dụ: Hộp/Thùng). Hệ thống sẽ tự quy đổi ra giá cơ sở."
                              >
                                <Access permission={PERMISSIONS.INVENTORY.VIEW_COST} hide fallback={<Input disabled value="******" />}>
                                    <InputNumber
                                    style={{ width: "100%" }}
                                    formatter={(v) =>
                                        `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                    }
                                    parser={(v) => v!.replace(/đ\s?|(,*)/g, "")}
                                    addonAfter="đ"
                                    onChange={handleModifyCostOrMargin}
                                    />
                                </Access>
                              </Form.Item>
                            </Col>

                            <Col xs={24} sm={12} md={8} lg={6}>
                               <Access 
                                  permission={PERMISSIONS.INVENTORY.VIEW_MARGIN_WHOLESALE}
                                  fallback={
                                    <Input.Group compact style={{display: 'none'}}>
                                      <Form.Item name="wholesaleMarginValue" noStyle><InputNumber /></Form.Item>
                                      <Form.Item name="wholesaleMarginType" noStyle><Select /></Form.Item>
                                    </Input.Group>  
                                  }
                               >
                              <Form.Item label="Lãi Bán Buôn">
                                <Input.Group compact>
                                  <Form.Item
                                    name="wholesaleMarginValue"
                                    noStyle
                                    initialValue={0}
                                  >
                                    <InputNumber 
                                      style={{ width: "calc(100% - 60px)" }} 
                                      min={0}
                                      onChange={handleModifyCostOrMargin}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    name="wholesaleMarginType"
                                    initialValue="amount"
                                    noStyle
                                  >
                                    <Select 
                                      style={{ width: "60px" }} 
                                      onChange={handleModifyCostOrMargin}
                                    >
                                      <Option value="percent">%</Option>
                                      <Option value="amount">đ</Option>
                                    </Select>
                                  </Form.Item>
                                </Input.Group>
                              </Form.Item>
                              </Access>
                            </Col>

                            <Col xs={24} sm={12} md={8} lg={6}>
                               <Access 
                                  permission={PERMISSIONS.INVENTORY.VIEW_MARGIN_RETAIL}
                                  fallback={
                                    <Input.Group compact style={{display: 'none'}}>
                                      <Form.Item name="retailMarginValue" noStyle><InputNumber /></Form.Item>
                                      <Form.Item name="retailMarginType" noStyle><Select /></Form.Item>
                                    </Input.Group>
                                  }
                               >
                               <Form.Item label="Lãi Bán Lẻ">
                                <Input.Group compact>
                                  <Form.Item
                                    name="retailMarginValue"
                                    noStyle
                                    initialValue={0}
                                  >
                                    <InputNumber 
                                      style={{ width: "calc(100% - 60px)" }} 
                                      min={0}
                                      onChange={handleModifyCostOrMargin}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    name="retailMarginType"
                                    initialValue="amount"
                                    noStyle
                                  >
                                    <Select 
                                      style={{ width: "60px" }}
                                      onChange={handleModifyCostOrMargin}
                                    >
                                      <Option value="percent">%</Option>
                                      <Option value="amount">đ</Option>
                                    </Select>
                                  </Form.Item>
                                </Input.Group>
                              </Form.Item>
                              </Access>
                            </Col>

                            {/* ROW 2: LOGISTICS */}
                            <Col span={24}>
                              <Divider orientation="left" plain>
                                <Space>
                                  <TruckOutlined />
                                  <span className="font-semibold text-blue-600">
                                    Thông tin Vận chuyển (Logistics)
                                  </span>
                                </Space>
                              </Divider>
                            </Col>

                            <Col xs={24} sm={8}>
                              <Form.Item
                                name="items_per_carton"
                                label="Quy cách (SL/Thùng)"
                                initialValue={1}
                                rules={[{ required: true, message: "Bắt buộc nhập" }]}
                                tooltip="Một thùng chứa bao nhiêu đơn vị bán buôn?"
                              >
                                <InputNumber
                                  style={{ width: "100%" }}
                                  min={1}
                                  formatter={(value) =>
                                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                                  }
                                  parser={(value) =>
                                    value?.replace(/\$\s?|(,*)/g, "") as any
                                  }
                                  addonAfter="Đơn vị/Thùng"
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item
                                name="carton_weight"
                                label="Trọng lượng (kg)"
                                initialValue={0}
                              >
                                <InputNumber
                                  style={{ width: "100%" }}
                                  min={0}
                                  step={0.1}
                                  addonAfter="kg"
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item
                                name="purchasing_policy"
                                label="Chính sách nhập"
                                initialValue="ALLOW_LOOSE"
                              >
                                <Select>
                                  <Option value="ALLOW_LOOSE">Cho phép nhập lẻ</Option>
                                  <Option value="FULL_CARTON_ONLY">
                                    Chỉ nhập nguyên thùng
                                  </Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={24}>
                              <Form.Item
                                name="carton_dimensions"
                                label="Kích thước (DxRxC)"
                              >
                                <Input placeholder="30x40x50 cm" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>

                        {/* UNTIS & CONVERSION */}
                        <Card
                          title={
                            <Space>
                              <ContainerOutlined /> Đơn vị tính & Quy đổi
                            </Space>
                          }
                          bordered={false}
                          style={{ marginBottom: 24 }}
                        >
                            <Form.List name="units">
                              {(fields, { add, remove }) => (
                                <>
                                  {fields.map(({ key, name, ...restField }) => (
                                    <Row key={key} gutter={16} align="middle" style={{ marginBottom: 12 }}>
                                      {/* Hidden ID để phục vụ Update */}
                                      <Form.Item name={[name, 'id']} hidden><Input /></Form.Item>
                                      
                                      <Col span={4}>
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'unit_name']}
                                          rules={[{ required: true, message: 'Nhập tên' }]}
                                          style={{ marginBottom: 0 }}
                                        >
                                          <Input placeholder="Tên (Hộp, Vỉ)" />
                                        </Form.Item>
                                      </Col>
                                      <Col span={4}>
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'unit_type']}
                                          style={{ marginBottom: 0 }}
                                        >
                                          <Select onChange={handleModifyCostOrMargin} placeholder="Loại">
                                              <Option value="base">Cơ sở</Option>
                                              <Option value="retail">Bán lẻ</Option>
                                              <Option value="wholesale">Bán buôn</Option>
                                              <Option value="logistics">Logistic</Option>
                                          </Select>
                                        </Form.Item>
                                      </Col>
                                      <Col span={3}>
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'conversion_rate']}
                                          rules={[{ required: true, message: 'Nhập tỷ lệ' }]}
                                          style={{ marginBottom: 0 }}
                                        >
                                          <InputNumber 
                                              placeholder="Rate" 
                                              style={{ width: '100%' }} 
                                              min={1} 
                                              onChange={handleModifyCostOrMargin}
                                          />
                                        </Form.Item>
                                      </Col>
                                      <Col span={5}>
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'price']}
                                          style={{ marginBottom: 0 }}
                                        >
                                          <InputNumber 
                                              placeholder="Giá bán" 
                                              style={{ width: '100%' }} 
                                              min={0}
                                              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                              parser={value => value ? value.replace(/\$\s?|(,*)/g, '') : '' as any}
                                              addonAfter="đ"
                                          />
                                        </Form.Item>
                                      </Col>
                                      <Col span={6}>
                                        <Form.Item
                                          {...restField}
                                          name={[name, 'barcode']}
                                          style={{ marginBottom: 0 }}
                                        >
                                          <Input placeholder="Mã vạch" prefix={<SearchOutlined />} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={2}>
                                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                      </Col>
                                    </Row>
                                  ))}
                                  <Form.Item>
                                    <Button 
                                      type="dashed" 
                                      onClick={() => add({
                                          unit_name: "",
                                          unit_type: "wholesale", 
                                          conversion_rate: 1,
                                          price: 0,
                                          barcode: ""
                                      })} 
                                      icon={<PlusOutlined />} 
                                    >
                                      Thêm Đơn vị quy đổi
                                    </Button>
                                  </Form.Item>
                                </>
                              )}
                            </Form.List>
                        </Card>
                        
                        <Card
                          title={
                            <Space>
                              <ContainerOutlined /> Cài đặt Tồn kho
                            </Space>
                          }
                          bordered={false}
                          style={{ marginBottom: 24 }}
                        >
                          <Row gutter={[16, 16]}>
                            {warehouses.map((wh) => (
                              <Col xs={24} sm={12} md={8} lg={6} key={wh.key}>
                                <Card
                                  size="small"
                                  title={wh.name}
                                  style={{ border: "1px solid #f0f0f0" }}
                                >
                                  <Row gutter={8}>
                                    <Col span={12}>
                                      <Form.Item
                                        name={["inventorySettings", wh.key, "min"]}
                                        label={`Tồn Min`}
                                        initialValue={0}
                                      >
                                        <InputNumber style={{ width: "100%" }} min={0} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name={["inventorySettings", wh.key, "max"]}
                                        label={`Tồn Max`}
                                        initialValue={0}
                                      >
                                        <InputNumber style={{ width: "100%" }} min={0} />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </Card>
                      </>
                    )
                  },

                  // TAB 2: Y TẾ & HDSD
                  {
                    key: "2",
                    label: <span><MedicineBoxOutlined /> Y tế & HDSD</span>,
                    children: (
                       <Card title="Hướng dẫn sử dụng & Y tế" bordered={false} style={{minHeight: 500}}>
                          <Row gutter={24}>
                            <Col span={12}>
                              <Form.Item label="Trẻ em 0-2 tuổi" name={['usageInstructions', '0_2']}>
                                 <Input.TextArea placeholder="Liều dùng..." rows={2} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Trẻ em 2-6 tuổi" name={['usageInstructions', '2_6']}>
                                 <Input.TextArea placeholder="Liều dùng..." rows={2} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Trẻ em 6-18 tuổi" name={['usageInstructions', '6_18']}>
                                 <Input.TextArea placeholder="Liều dùng..." rows={2} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                               <Form.Item label="Người lớn (>18 tuổi)" name={['usageInstructions', '18_plus']}>
                                 <Input.TextArea placeholder="Liều dùng..." rows={2} />
                              </Form.Item>
                            </Col>
                            <Col span={24}>
                               <Form.Item label="Chống chỉ định / Lưu ý đặc biệt" name={['usageInstructions', 'contraindication']}>
                                 <Input.TextArea placeholder="Các trường hợp không được sử dụng thuốc..." rows={3} showCount />
                              </Form.Item>
                            </Col>
                          </Row>
                       </Card>
                    )
                  },

                  // TAB 3: MARKETING & SEO
                  {
                    key: "3",
                    label: <span><GlobalOutlined /> Marketing & SEO</span>,
                    children: (
                       <Access permission={PERMISSIONS.MARKETING.EDIT_CONTENT}>
                        <Card title="Nội dung & SEO Website" bordered={false} style={{minHeight: 500}}>
                          <Row gutter={24}>
                             <Col span={24}>
                               <Form.Item label="SEO Title (Tiêu đề hiển thị Google)" name={['content', 'seo_title']}>
                                 <Input showCount maxLength={70} />
                               </Form.Item>
                             </Col>
                             <Col span={24}>
                               <Form.Item label="SEO Description (Mô tả ngắn tìm kiếm)" name={['content', 'seo_description']}>
                                 <Input.TextArea showCount maxLength={160} rows={2} />
                               </Form.Item>
                             </Col>
                             <Col span={24}>
                               <Form.Item label="SEO Keywords (Từ khóa)" name={['content', 'seo_keywords']}>
                                 <Select mode="tags" placeholder="Nhập từ khóa và ấn Enter..." tokenSeparators={[',']} />
                               </Form.Item>
                             </Col>
                             <Col span={24}>
                                <Divider dashed />
                                <Form.Item label="Nội dung chi tiết (HTML)" name={['content', 'description_html']}>
                                  <Input.TextArea 
                                    rows={10} 
                                    placeholder="<div>Nội dung HTML bài viết...</div>" 
                                    style={{fontFamily: 'monospace'}}
                                  />
                                </Form.Item>
                                 <Typography.Text type="secondary" italic>
                                    Mẹo: Có thể dùng công cụ AI Scan để tự tạo nội dung HTML đẹp mắt.
                                 </Typography.Text>
                             </Col>
                          </Row>
                       </Card>
                       </Access>
                    )
                  }
                ]}
              />

              <Affix offsetBottom={0}>
                <Card
                  styles={{
                    body: {
                      padding: "12px 24px",
                      textAlign: "right",
                      borderTop: "1px solid #f0f0f0",
                      background: "rgba(255,255,255,0.8)",
                      backdropFilter: "blur(5px)",
                    },
                  }}
                >
                  <Space>
                    <Button
                      icon={<CloseCircleOutlined />}
                      onClick={handleCancel}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={loading}
                    >
                      {isEditing ? "Lưu Cập nhật" : "Lưu Sản phẩm"}
                    </Button>
                  </Space>
                </Card>
              </Affix>
            </Form>
            <SupplierSelectModal
              open={isSupplierModalOpen}
              onClose={() => setIsSupplierModalOpen(false)}
              onSelect={(s) => {
                form.setFieldsValue({ distributor: s.id });
                setSelectedSupplierName(s.name);
                setIsSupplierModalOpen(false);
              }}
            />
          </Content>
        </Spin>
      </Layout>
      {/* [NEW] AI Scanner Modal */}
      <ProductAiScannerModal 
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode="fill_form"
        onSuccess={handleAiFill}
      />
    </ConfigProvider>
  );
};

export default ProductFormPage;
