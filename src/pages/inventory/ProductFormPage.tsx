// src/pages/inventory/ProductFormPage.tsx
import {
  UploadOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  ContainerOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
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

import SupplierSelectModal from "@/components/common/SupplierSelectModal";
import {
  addProduct,
  updateProduct,
  uploadProductImage,
} from "@/services/productService"; // Import các hàm API
import { useProductStore } from "@/stores/productStore";

const { Content } = Layout;
const { Title, Paragraph } = Typography;
const { Option } = Select;

const ProductFormPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const {
    warehouses,
    suppliers,
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

  // Tải data chung (kho, ncc)
  useEffect(() => {
    fetchCommonData();
  }, [fetchCommonData]);

  // Tải data chi tiết sản phẩm (nếu là Sửa)
  useEffect(() => {
    if (isEditing) {
      getProductDetails(Number(id));
    }
  }, [isEditing, id, getProductDetails]);

  // Điền form sau khi data chi tiết đã tải xong
  useEffect(() => {
    if (isEditing && currentProduct) {
      form.setFieldsValue(currentProduct);
      if (currentProduct.distributor) {
        // Tải tên NCC từ "bộ não" để hiển thị
        const supplier = useProductStore
          .getState()
          .suppliers.find((s) => s.id === currentProduct.distributor);
        if (supplier) setSelectedSupplierName(supplier.name);
      }
      if (currentProduct.imageUrl) {
        setImageUrl(currentProduct.imageUrl);
        setFileList([
          {
            uid: "-1",
            name: "image.png",
            status: "done",
            url: currentProduct.imageUrl,
          },
        ]);
      }
    }
  }, [isEditing, currentProduct, form]);

  const handleCancel = () => {
    navigate("/inventory"); // Quay lại trang danh sách
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let finalImageUrl = imageUrl;

      // 1. Nếu người dùng TẢI ẢNH MỚI
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải ảnh lên...", key: "upload" });
        finalImageUrl = await uploadProductImage(fileList[0].originFileObj);
        antMessage.success({ content: "Tải ảnh thành công!", key: "upload" });
      }

      // 2. Gói dữ liệu
      const finalValues = { ...values, imageUrl: finalImageUrl };
      console.log("Form Values to Save:", finalValues);

      if (isEditing) {
        // CHẾ ĐỘ SỬA
        await updateProduct(Number(id), finalValues);
        antMessage.success(
          `Cập nhật sản phẩm "${finalValues.productName}" thành công!`
        );
      } else {
        // CHẾ ĐỘ THÊM
        await addProduct(finalValues);
        antMessage.success(
          `Tạo sản phẩm "${finalValues.productName}" thành công!`
        );
      }

      navigate("/inventory"); // Quay về trang danh sách
    } catch (error: any) {
      antMessage.error(`Lỗi: ${error.message || "Không thể lưu sản phẩm"}`);
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

  // Logic Tải ảnh (customRequest) - GIỜ LÀ THẬT
  const handleUpload: UploadProps["customRequest"] = async ({
    onSuccess,
    onError,
  }) => {
    try {
      // Chúng ta sẽ "giả lập" việc tải lên thành công ở đây
      // Logic tải thật sẽ nằm trong onFinish
      // Điều này cho phép user "preview" ảnh trước khi bấm LƯU
      if (onSuccess) {
        onSuccess("ok");
      }
    } catch (err) {
      if (onError) {
        onError(err as Error);
      }
    }
  };

  const onUploadChange: UploadProps["onChange"] = ({
    fileList: newFileList,
  }) => {
    setFileList(newFileList);
    if (newFileList.length === 0) {
      setImageUrl("");
    } else {
      // Cập nhật state file để onFinish có thể dùng
      setFileList(
        newFileList.map((f) => ({
          ...f,
          originFileObj: f.originFileObj || undefined,
        }))
      );
    }
  };

  // (Logic tính giá từ Canvas của Sếp - giữ nguyên)
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
                ? `Chỉnh sửa: ${currentProduct?.productName || `Sản phẩm (ID: ${id})`}`
                : "Thêm Sản phẩm mới"}
            </Title>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={calculatePrices}
            >
              {/* Section 1: Thông tin Chung */}
              <Card
                title={
                  <Space>
                    <InfoCircleOutlined /> Thông tin Chung
                  </Space>
                }
                bordered={false}
                style={{ marginBottom: 24 }}
                extra={
                  <Button icon={<FilePdfOutlined />} disabled>
                    Làm giàu dữ liệu từ PDF (Sắp ra mắt)
                  </Button>
                }
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
                            {" "}
                            <UploadOutlined /> <div>Tải ảnh lên</div>{" "}
                          </div>
                        )}
                      </Upload>
                      <Input
                        placeholder="Hoặc dán URL ảnh vào đây..."
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
                          preview={false}
                          style={{
                            marginTop: 8,
                            border: "1px dashed #d9d9d9",
                            padding: "4px",
                            borderRadius: "8px",
                          }}
                          fallback="https://placehold.co/102x102/eee/ccc?text=Invalid URL"
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
                        <Form.Item name="barcode" label="Mã vạch (Barcode)">
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12} lg={8}>
                        <Form.Item name="category" label="Phân loại SP">
                          <Input placeholder="vd: Kháng sinh" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={8}>
                        <Form.Item name="manufacturer" label="Công ty Sản xuất">
                          <Input placeholder="vd: Dược Hậu Giang" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={8}>
                        {/* 1. Form Item GIẢ (chỉ để hiển thị) */}
                        <Form.Item label="Công ty Phân phối (NCC)">
                          <Input
                            placeholder="Nhấn để chọn nhà cung cấp"
                            value={selectedSupplierName} // value này sẽ KHÔNG bị ghi đè
                            onClick={() => setIsSupplierModalOpen(true)}
                            readOnly
                            addonAfter={<SearchOutlined />}
                            style={{ cursor: "pointer" }}
                          />
                        </Form.Item>

                        {/* 2. Form Item THẬT (dùng để lưu ID, không hiển thị) */}
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
                        <Form.Item name="packingSpec" label="Quy cách đóng gói">
                          <Input placeholder="vd: Hộp 10 vỉ x 10 viên" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={8}>
                        <Form.Item name="tags" label="Hoạt chất chính">
                          <Input placeholder="vd: Paracetamol" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider />
                    <Form.Item
                      name="description"
                      label="Mô tả & Hướng dẫn sử dụng chung"
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    {/* (Các trường HDSD khác giữ nguyên) */}
                  </Col>
                </Row>
              </Card>

              {/* Section 2: Giá & Kinh Doanh (Giữ nguyên) */}
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
                      Giá Vốn & Lợi Nhuận
                    </Divider>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item name="invoicePrice" label="Giá nhập trên HĐ">
                      <InputNumber
                        style={{ width: "100%" }}
                        formatter={(value) =>
                          `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) => value!.replace(/đ\s?|(,*)/g, "")}
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
                        formatter={(value) =>
                          `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) => value!.replace(/đ\s?|(,*)/g, "")}
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
                          <InputNumber
                            style={{ width: "calc(100% - 60px)" }}
                            min={0}
                          />
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
                    <Form.Item label="Lãi Bán lẻ (trên ĐV Buôn)">
                      <Input.Group compact>
                        <Form.Item
                          name="retailMarginValue"
                          noStyle
                          initialValue={0}
                        >
                          <InputNumber
                            style={{ width: "calc(100% - 60px)" }}
                            min={0}
                          />
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
                      label={`Giá Bán Buôn`}
                    >
                      <InputNumber
                        style={{
                          width: "100%",
                          fontWeight: "bold",
                          backgroundColor: "#f0f2f5",
                        }}
                        formatter={(value) =>
                          `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) => value!.replace(/đ\s?|(,*)/g, "")}
                        addonAfter="đ"
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8} lg={4}>
                    <Form.Item name="estimatedRetailPrice" label={`Giá Bán Lẻ`}>
                      <InputNumber
                        style={{
                          width: "100%",
                          fontWeight: "bold",
                          backgroundColor: "#f0f2f5",
                        }}
                        formatter={(value) =>
                          `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        }
                        parser={(value) => value!.replace(/đ\s?|(,*)/g, "")}
                        addonAfter="đ"
                        readOnly
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* Section 3: Cài đặt Tồn kho (Đã sửa) */}
              <Card
                title={
                  <Space>
                    <ContainerOutlined /> Cài đặt Tồn kho
                  </Space>
                }
                bordered={false}
                style={{ marginBottom: 24 }}
              >
                <Paragraph type="secondary">
                  Cài đặt tồn kho tối thiểu và tối đa cho từng kho. Khi tồn kho
                  dưới mức tối thiểu, hệ thống sẽ tự động gợi ý nhập hàng.
                </Paragraph>
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
                              label={`Tồn Min (${wh.unit})`}
                              initialValue={0}
                            >
                              <InputNumber style={{ width: "100%" }} min={0} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name={["inventorySettings", wh.key, "max"]}
                              label={`Tồn Max (${wh.unit})`}
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

              {/* Thanh Action (Đã kết nối) */}
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
            {/* --- THÊM MODAL CHỌN NCC --- */}
            <SupplierSelectModal
              open={isSupplierModalOpen}
              onClose={() => setIsSupplierModalOpen(false)}
              onSelect={(supplier) => {
                // Cập nhật cả ID (vào Form) và Tên (vào State)
                form.setFieldsValue({ distributor: supplier.id });
                setSelectedSupplierName(supplier.name);
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
