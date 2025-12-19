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
  App as AntApp,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { UploadFile, UploadProps } from "antd/es/upload/interface";

import SupplierSelectModal from "@/shared/ui/common/SupplierSelectModal";
// SỬ DỤNG SERVICE
import {
  addProduct,
  updateProduct,
  uploadProductImage,
} from "@/features/inventory/api/productService";
import { useProductStore } from "@/features/inventory/stores/productStore";

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const ProductFormPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const {
    warehouses,
    fetchCommonData,
    currentProduct,
    getProductDetails,
    loadingDetails,
  } = useProductStore();
  const { message: antMessage } = AntApp.useApp();

  const [loading, setLoading] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");

  useEffect(() => {
    fetchCommonData();
  }, []); // <--- Rỗng: Chỉ chạy 1 lần

  useEffect(() => {
    if (isEditing) {
      getProductDetails(Number(id));
    }
  }, [isEditing, id, getProductDetails]);

  useEffect(() => {
    if (isEditing && currentProduct) {
      // Fill dữ liệu vào form
      form.setFieldsValue(currentProduct);

      // Hiển thị tên NCC
      if (currentProduct.distributor_id) {
        const supplier = useProductStore
          .getState()
          .suppliers.find((s) => s.id === currentProduct.distributor_id);
        if (supplier) setSelectedSupplierName(supplier.name);
      }

      // Hiển thị ảnh
      if (currentProduct.image_url) {
        setImageUrl(currentProduct.image_url);
        setFileList([
          {
            uid: "-1",
            name: "image.png",
            status: "done",
            url: currentProduct.image_url,
          },
        ]);
      }

      // Map trường active_ingredient -> tags của form (nếu chưa có)
      if (currentProduct.active_ingredient && !form.getFieldValue("tags")) {
        form.setFieldsValue({ tags: currentProduct.active_ingredient });
      }
    }
  }, [isEditing, currentProduct, form]);

  const handleCancel = () => {
    navigate("/inventory");
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let finalImageUrl = imageUrl;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải ảnh lên...", key: "upload" });
        finalImageUrl = await uploadProductImage(fileList[0].originFileObj);
        antMessage.success({ content: "Tải ảnh thành công!", key: "upload" });
      }

      const finalValues = { ...values, imageUrl: finalImageUrl };

      if (isEditing) {
        await updateProduct(Number(id), finalValues);
        antMessage.success(`Cập nhật sản phẩm thành công!`);
      } else {
        await addProduct(finalValues);
        antMessage.success(`Tạo sản phẩm thành công!`);
      }

      navigate("/inventory");
    } catch (error: any) {
      console.error(error);
      // Hiển thị lỗi chi tiết hơn nếu có
      const msg = error.message || error.details || "Không thể lưu sản phẩm";
      antMessage.error(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = () => {
    const productName = form.getFieldValue("productName");
    if (!productName) {
      antMessage.warning("Vui lòng nhập Tên sản phẩm trước khi tìm ảnh.");
      return;
    }
    const query = encodeURIComponent(`${productName} product image`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
  };

  const handleUpload: UploadProps["customRequest"] = async ({ onSuccess }) => {
    if (onSuccess) onSuccess("ok");
  };

  const onUploadChange: UploadProps["onChange"] = ({
    fileList: newFileList,
  }) => {
    setFileList(newFileList);
    if (newFileList.length === 0) setImageUrl("");
  };

  const calculatePrices = () => {
    const allValues = form.getFieldsValue();
    const actualCost = parseFloat(allValues.actualCost) || 0;
    const conversionFactor = parseFloat(allValues.conversionFactor) || 1;
    const wholesaleMarginValue =
      parseFloat(allValues.wholesaleMarginValue) || 0;
    const retailMarginValue = parseFloat(allValues.retailMarginValue) || 0;
    const wholesaleMarginType = allValues.wholesaleMarginType || "%";
    const retailMarginType = allValues.retailMarginType || "%";

    let calculatedWholesalePrice = 0;
    if (wholesaleMarginType === "%") {
      calculatedWholesalePrice = actualCost * (1 + wholesaleMarginValue / 100);
    } else {
      calculatedWholesalePrice = actualCost + wholesaleMarginValue;
    }
    form.setFieldsValue({ estimatedWholesalePrice: calculatedWholesalePrice });

    let calculatedRetailPrice = 0;
    if (retailMarginType === "%") {
      const profitPerWholesaleUnit = actualCost * (retailMarginValue / 100);
      calculatedRetailPrice =
        (actualCost + profitPerWholesaleUnit) / conversionFactor;
    } else {
      calculatedRetailPrice =
        (actualCost + retailMarginValue) / conversionFactor;
    }
    const roundedRetailPrice = Math.round(calculatedRetailPrice / 100) * 100;
    form.setFieldsValue({ estimatedRetailPrice: roundedRetailPrice });
  };

  return (
    <ConfigProvider locale={viVN}>
      <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
        <Spin
          spinning={loading || loadingDetails}
          tip={loading ? "Đang xử lý..." : "Đang tải dữ liệu..."}
        >
          <Content style={{ padding: "12px" }}>
            <Title level={4} style={{ marginBottom: "12px" }}>
              {isEditing
                ? `Chỉnh sửa: ${currentProduct?.name || "Sản phẩm"}`
                : "Thêm Sản phẩm mới"}
            </Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={calculatePrices}
            >
              <Card
                title={
                  <Space>
                    <InfoCircleOutlined /> Thông tin Chung
                  </Space>
                }
                bordered={false}
                style={{ marginBottom: 24 }}
              >
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
                          <Input
                            placeholder="Chọn nhà cung cấp..."
                            value={selectedSupplierName}
                            onClick={() => setIsSupplierModalOpen(true)}
                            readOnly
                            addonAfter={<SearchOutlined />}
                            style={{ cursor: "pointer" }}
                          />
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
                    <Divider />
                    <Form.Item name="description" label="Mô tả & HDSD">
                      <Input.TextArea rows={4} />
                    </Form.Item>
                  </Col>
                </Row>
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
                <Row gutter={24}>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item
                      name="wholesaleUnit"
                      label="ĐV Bán Buôn"
                      initialValue="Hộp"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item
                      name="retailUnit"
                      label="ĐV Bán lẻ"
                      initialValue="Vỉ"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item
                      name="conversionFactor"
                      label="SL Quy đổi"
                      initialValue={10}
                    >
                      <InputNumber style={{ width: "100%" }} min={1} />
                    </Form.Item>
                  </Col>

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
                        // --- SỬA LỖI TẠI ĐÂY: Thêm 'as any' ---
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

                  <Col span={24}>
                    <Divider orientation="left" plain>
                      Giá Vốn & Lợi Nhuận
                    </Divider>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
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
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item
                      name="actualCost"
                      label="Giá Vốn Thực Tế*"
                      rules={[{ required: true }]}
                      initialValue={0}
                    >
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

                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item label="Lãi Bán Buôn">
                      <Input.Group compact>
                        <Form.Item
                          name="wholesaleMarginValue"
                          noStyle
                          initialValue={0}
                        >
                          <InputNumber style={{ width: "calc(100% - 60px)" }} />
                        </Form.Item>
                        <Form.Item
                          name="wholesaleMarginType"
                          initialValue="%"
                          noStyle
                        >
                          <Select style={{ width: "60px" }}>
                            <Option value="%">%</Option>
                            <Option value="đ">đ</Option>
                          </Select>
                        </Form.Item>
                      </Input.Group>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item label="Lãi Bán Lẻ">
                      <Input.Group compact>
                        <Form.Item
                          name="retailMarginValue"
                          noStyle
                          initialValue={0}
                        >
                          <InputNumber style={{ width: "calc(100% - 60px)" }} />
                        </Form.Item>
                        <Form.Item
                          name="retailMarginType"
                          initialValue="%"
                          noStyle
                        >
                          <Select style={{ width: "60px" }}>
                            <Option value="%">%</Option>
                            <Option value="đ">đ</Option>
                          </Select>
                        </Form.Item>
                      </Input.Group>
                    </Form.Item>
                  </Col>

                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item
                      name="estimatedWholesalePrice"
                      label="Giá Bán Buôn"
                    >
                      <InputNumber
                        style={{
                          width: "100%",
                          fontWeight: "bold",
                          background: "#f0f2f5",
                        }}
                        formatter={(v) =>
                          `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        readOnly
                        addonAfter="đ"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item name="estimatedRetailPrice" label="Giá Bán Lẻ">
                      <InputNumber
                        style={{
                          width: "100%",
                          fontWeight: "bold",
                          background: "#f0f2f5",
                        }}
                        formatter={(v) =>
                          `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        readOnly
                        addonAfter="đ"
                      />
                    </Form.Item>
                  </Col>
                </Row>
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
                              label="Tồn Min"
                              initialValue={0}
                            >
                              <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name={["inventorySettings", wh.key, "max"]}
                              label="Tồn Max"
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
    </ConfigProvider>
  );
};

export default ProductFormPage;
