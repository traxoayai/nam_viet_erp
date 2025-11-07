import {
  UploadOutlined,
  SaveOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  ConfigProvider,
  Space,
  Upload,
  Form,
  message,
  Tooltip,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState } from "react";
import "dayjs/locale/vi";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Mock data giả lập thông tin công ty đã lưu
const mockCompanyData = {
  companyName: "Công ty TNHH Dược phẩm Nam Việt",
  taxCode: "0100123456",
  address: "Số 1, Đường Hữu Nghị, Thành phố Lạng Sơn, Tỉnh Lạng Sơn",
  phone: "025 1234 5678",
  email: "contact@duocnamviet.com.vn",
  website: "https.duocnamviet.com.vn",
  mission:
    "Cung cấp các sản phẩm và dịch vụ y tế chất lượng cao, an toàn, hiệu quả với chi phí hợp lý, góp phần nâng cao sức khỏe cộng đồng.",
  vision:
    "Trở thành biểu tượng niềm tin hàng đầu Việt Nam trong lĩnh vực dược phẩm và chăm sóc sức khỏe.",
  logoUrl: "https://example.com/logo.png", // Cần một link logo mẫu
};

const CompanySettingsPage = () => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([
    // Mock file logo đã tải lên
    {
      uid: "-1",
      name: "logo_nam_viet.png",
      status: "done",
      url: "https://cdn.jiohealth.com/jio-website/home-page/jio-tele-medicine.svg", // Dùng tạm 1 link ảnh
    },
  ]);

  const onFinish = (values) => {
    console.log("Submitted values:", values);
    message.success("Đã cập nhật thông tin công ty thành công!");
  };

  const handleUploadChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const uploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      // Giả lập upload thành công
      setFileList([
        ...fileList,
        {
          ...file,
          status: "done",
          url: URL.createObjectURL(file),
          name: file.name,
        },
      ]);
      return false; // Ngăn upload thực tế
    },
    fileList,
    listType: "picture-card",
    maxCount: 1,
  };

  return (
    <ConfigProvider locale={viVN}>
      <Card bordered={true} style={{ border: "1px solid #d9d9d9" }}>
        <Title level={4} style={{ margin: 0, marginBottom: 24 }}>
          Cấu hình Thông tin Công ty (Cấu hình Chung)
        </Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={mockCompanyData}
        >
          <Row gutter={24}>
            {/* Cột trái: Thông tin chính */}
            <Col xs={24} md={16}>
              <Card
                title="Thông tin pháp lý & Liên hệ"
                bordered={false}
                style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e8e8e8",
                }}
              >
                <Row gutter={16}>
                  <Col span={18}>
                    <Form.Item
                      name="companyName"
                      label="Tên Công ty (Theo ĐKKD)"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên công ty!",
                        },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="taxCode"
                      label="Mã số thuế"
                      rules={[
                        { required: true, message: "Vui lòng nhập MST!" },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="address"
                      label="Địa chỉ (Xuất hóa đơn)"
                      rules={[
                        { required: true, message: "Vui lòng nhập địa chỉ!" },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="phone"
                      label="Số điện thoại Tổng đài"
                      rules={[
                        { required: true, message: "Vui lòng nhập SĐT!" },
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="email" label="Email Công ty">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="website" label="Website">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Cột phải: Logo */}
            <Col xs={24} md={8}>
              <Card
                title="Logo Công ty"
                bordered={false}
                style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e8e8e8",
                  height: "100%",
                }}
              >
                <Form.Item
                  name="logo"
                  label="Tải lên Logo"
                  tooltip="Logo này sẽ được tự động chèn vào các phiếu in và báo giá."
                >
                  <Upload {...uploadProps}>
                    {fileList.length < 1 && (
                      <div>
                        <UploadOutlined />
                        <div>Tải lên</div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </Card>
            </Col>

            {/* Phần dưới: Tầm nhìn / Sứ mệnh */}
            <Col span={24} style={{ marginTop: 24 }}>
              <Card
                title="Tầm nhìn & Sứ mệnh"
                bordered={false}
                style={{
                  backgroundColor: "#fafafa",
                  border: "1px solid #e8e8e8",
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="vision" label="Tầm nhìn (Vision)">
                      <TextArea rows={4} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="mission" label="Sứ mệnh (Mission)">
                      <TextArea rows={4} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Nút Lưu */}
          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              size="large"
            >
              Lưu thay đổi
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </ConfigProvider>
  );
};

export default CompanySettingsPage;
