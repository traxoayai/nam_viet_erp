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
  AutoComplete,
  Divider,
  Affix,
  message,
  Form,
  Image,
  App as AntApp,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { UploadFile, UploadProps } from "antd/es/upload/interface";

import { addProduct } from "@/services/productService"; // "Cỗ máy" lưu SP
import { uploadFile } from "@/services/storageService"; // "Cỗ máy" tải ảnh
import { useProductStore } from "@/stores/productStore";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const ProductFormPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  // Lấy data thật từ "bộ não"
  const { categories, manufacturers, warehouses, fetchFiltersData } =
    useProductStore();
  const { message: antMessage } = AntApp.useApp(); // Dùng hook 'message'

  // State của Component
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [productNameForSearch, setProductNameForSearch] = useState("");

  // (SENKO: Sẽ dùng logic này khi làm chức năng "Sửa")
  // useEffect(() => {
  //   if (isEditing) {
  //     // TODO: Tải dữ liệu sản phẩm (ID) và form.setFieldsValue(data)
  //   }
  //   // Tải data cho các bộ lọc
  //   fetchFiltersData();
  // }, [id, isEditing, fetchFiltersData, form]);

  // Chỉ tải data bộ lọc
  useEffect(() => {
    if (
      categories.length === 0 ||
      manufacturers.length === 0 ||
      warehouses.length === 0
    ) {
      fetchFiltersData();
    }
  }, [fetchFiltersData, categories, manufacturers, warehouses]);

  // --- TASK 2: Logic Nút HỦY ---
  const handleCancel = () => {
    navigate(-1); // Quay lại trang trước đó
  };

  // --- TASK 2: Logic Nút LƯU ---
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let finalImageUrl = imageUrl; // Lấy từ ô URL

      // 1. Nếu người dùng có tải ảnh lên (fileList)
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải ảnh lên...", key: "upload" });
        finalImageUrl = await uploadFile(
          fileList[0].originFileObj,
          "product_images"
        );
        setImageUrl(finalImageUrl); // Cập nhật state
        antMessage.success({ content: "Tải ảnh thành công!", key: "upload" });
      }

      // 2. Gói dữ liệu và gọi API lưu
      const finalValues = { ...values, imageUrl: finalImageUrl };
      console.log("Form Values to Save:", finalValues);

      const newProductId = await addProduct(finalValues);

      antMessage.success(`Tạo sản phẩm (ID: ${newProductId}) thành công!`);
      navigate("/inventory"); // Quay về trang danh sách
    } catch (error: any) {
      antMessage.error(`Lỗi: ${error.message || "Không thể lưu sản phẩm"}`);
    } finally {
      setLoading(false);
    }
  };

  // --- TASK 3: Logic Nút TÌM ẢNH ---
  const handleImageSearch = () => {
    if (!productNameForSearch) {
      antMessage.warning("Vui lòng nhập Tên sản phẩm trước khi tìm ảnh.");
      return;
    }
    // Mở tab Google Images
    const query = encodeURIComponent(`${productNameForSearch} product image`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
  };

  // Logic Tải ảnh (customRequest)
  const handleUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    // Đây chỉ là hàm giả lập, logic thật nằm trong onFinish
    // để chúng ta chỉ tải ảnh KHI bấm LƯU
    setTimeout(() => {
      if (onSuccess) onSuccess("ok");
    }, 0);
  };

  // Cập nhật fileList khi người dùng thêm/xóa ảnh
  const onUploadChange: UploadProps["onChange"] = ({
    fileList: newFileList,
  }) => {
    setFileList(newFileList);
    if (newFileList.length === 0) {
      setImageUrl(""); // Xóa URL nếu ảnh bị xóa
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
        <Spin spinning={loading} tip="Đang xử lý...">
          <Content style={{ padding: "24px" }}>
            <Title level={3} style={{ marginBottom: "24px" }}>
              {isEditing
                ? `Chỉnh sửa Sản phẩm (ID: ${id})`
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
                  {/* Cột Ảnh */}
                  <Col xs={24} md={6}>
                    <Form.Item label="Ảnh sản phẩm">
                      <Upload
                        listType="picture-card"
                        fileList={fileList}
                        onChange={onUploadChange}
                        customRequest={handleUpload} // Dùng customRequest
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

                  {/* Cột Thông tin */}
                  <Col xs={24} md={18}>
                    <Row gutter={16}>
                      <Col xs={24} lg={12}>
                        <Form.Item
                          name="productName"
                          label="Tên sản phẩm"
                          rules={[{ required: true }]}
                        >
                          <Input
                            onChange={(e) =>
                              setProductNameForSearch(e.target.value)
                            }
                          />
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
                          <AutoComplete
                            options={categories.map((cat) => ({
                              label: cat.name,
                              value: cat.name,
                            }))}
                            filterOption={(inputValue, option) =>
                              option!.label
                                .toUpperCase()
                                .indexOf(inputValue.toUpperCase()) !== -1
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={8}>
                        <Form.Item name="manufacturer" label="Công ty Sản xuất">
                          <AutoComplete
                            options={manufacturers.map((m) => ({
                              label: m.name,
                              value: m.name,
                            }))}
                            filterOption={(inputValue, option) =>
                              option!.label
                                .toUpperCase()
                                .indexOf(inputValue.toUpperCase()) !== -1
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={8}>
                        <Form.Item name="distributor" label="Công ty Phân phối">
                          <AutoComplete
                            options={[]}
                            placeholder="(Sẽ kết nối API)"
                            disabled
                          />
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
                    <Row gutter={16}>
                      <Col xs={24} sm={12} lg={6}>
                        <Form.Item name="usage_0_2" label="HDSD (0-2t)">
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={6}>
                        <Form.Item name="usage_2_6" label="HDSD (2-6t)">
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={6}>
                        <Form.Item name="usage_6_18" label="HDSD (6-18t)">
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} lg={6}>
                        <Form.Item name="usage_18_plus" label="HDSD (>18t)">
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      name="applicableDisease"
                      label="Bệnh Áp dụng (Gợi ý từ AI)"
                    >
                      <AutoComplete
                        options={[]}
                        placeholder="Tìm hoặc nhập bệnh... (Sắp ra mắt)"
                        disabled
                      />
                    </Form.Item>
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

              {/* Section 3: Cài đặt Tồn kho (Đã sửa lỗi) */}
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
                  bordered={false}
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
                    >
                      Lưu thay đổi
                    </Button>
                  </Space>
                </Card>
              </Affix>
            </Form>
          </Content>
        </Spin>
      </Layout>
    </ConfigProvider>
  );
};

export default ProductFormPage;
