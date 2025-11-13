// src/pages/crm/CustomerB2COrgForm.tsx
import {
  SaveOutlined,
  ArrowLeftOutlined,
  IdcardOutlined,
  HistoryOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Table,
  Button,
  Card,
  Typography,
  Row,
  Col,
  Space,
  Form,
  App as AntApp,
  Divider,
  Affix,
  Upload,
  Tabs,
  Empty,
  Spin,
  ConfigProvider,
} from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import type { TableProps } from "antd";

// IMPORT "BỘ NÃO" VÀ "KHUÔN MẪU"
import { uploadAvatar } from "@/services/customerService";
import { useCustomerB2CStore } from "@/stores/useCustomerB2CStore";
import { CustomerHistory, CustomerFormData } from "@/types/customer";

const { Content } = Layout;
const { Title } = Typography;

// --- CSS INLINE (Style từ Canvas) ---
const styles = {
  card: {
    margin: "12px",
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
};

// --- HÀM TĨNH ---
const phoneFormatter = (value: string | undefined) => {
  if (!value) return "";
  const phoneNumber = value.replace(/[^\d]/g, "");
  const match = phoneNumber.match(/^(\d{0,4})(\d{0,3})(\d{0,3})$/);
  if (!match) return phoneNumber;
  return [match[1], match[2], match[3]].filter(Boolean).join(".");
};

// --- COMPONENT CHÍNH ---
const CustomerB2COrgForm: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();
  const navigate = useNavigate();
  const { id } = useParams(); // Lấy ID từ URL
  const isNew = !id;

  const {
    loading,
    editingCustomer,
    getCustomerDetails,
    createCustomer,
    updateCustomer,
  } = useCustomerB2CStore(); // State cục bộ

  const [fileList, setFileList] = useState<any[]>([]); // Tải dữ liệu khi SỬA

  useEffect(() => {
    if (id) {
      getCustomerDetails(Number(id));
    }
  }, [id, getCustomerDetails]); // Điền form khi dữ liệu Sửa về

  useEffect(() => {
    if (!isNew && editingCustomer && !loading) {
      const customer = editingCustomer.customer;
      const initialValues = {
        ...customer,
        phone: phoneFormatter(customer.phone || undefined),
        contact_person_phone: phoneFormatter(
          customer.contact_person_phone || undefined
        ),
        history: (editingCustomer.history || []).map((h) => ({
          ...h,
          key: uuidv4(),
        })),
      };
      form.setFieldsValue(initialValues);
      setFileList(
        customer.avatar_url
          ? [
              {
                uid: "-1",
                name: "logo.png",
                status: "done",
                url: customer.avatar_url,
              },
            ]
          : []
      );
    } else if (isNew) {
      form.resetFields();
      form.setFieldsValue({ status: "active" });
      setFileList([]);
    }
  }, [isNew, editingCustomer, loading, form]);

  const handleSave = async () => {
    const msgKey = "save_org";
    try {
      const values = await form.validateFields();
      antMessage.loading({ content: "Đang xử lý...", key: msgKey });

      let finalAvatarUrl =
        fileList.length > 0 ? fileList[0].url || fileList[0].thumbUrl : null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        finalAvatarUrl = await uploadAvatar(fileList[0].originFileObj as File);
      }

      const customerData: Partial<CustomerFormData> = {
        name: values.name,
        type: "ToChuc", // Gán cứng loại
        phone: values.phone?.replace(/\./g, ""), // SĐT chính (SĐT Bàn)
        email: values.email,
        address: values.address,
        tax_code: values.tax_code,
        contact_person_name: values.contact_person_name,
        contact_person_phone: values.contact_person_phone?.replace(/\./g, ""),
        avatar_url: finalAvatarUrl,
        status: values.status || "active",
      };

      if (isNew) {
        await createCustomer(customerData, []); // Không có người giám hộ
      } else {
        await updateCustomer(Number(id), customerData, []);
      }
      antMessage.success({
        content: "Lưu hồ sơ Tổ chức thành công!",
        key: msgKey,
      });
      navigate("/crm/retail"); // Quay về danh sách chung
    } catch (error: any) {
      console.error("Lỗi Save:", error);
      antMessage.error({
        content: `Lưu thất bại: ${error.message}`,
        key: msgKey,
      });
    }
  }; // --- GIAO DIỆN FORM ---

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
  ];

  const handleUploadChange = ({ fileList: newFileList }: any) => {
    setFileList(newFileList);
  };

  return (
    <ConfigProvider locale={viVN}>
           
      <style>{`
        .ant-upload-list-item-container { width: 100px !important; height: 100px !important; }
        .ant-upload.ant-upload-select-picture-card { width: 100px !important; height: 100px !important; padding: 0 !important; margin: 0 !important; }
      `}</style>
           
      <Layout style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
               
        <Form form={form} layout="vertical" onFinish={handleSave}>
                   
          <Affix offsetTop={40} style={{ zIndex: 10 }}>
                       
            <Card
              style={{
                ...styles.card,
                margin: "0 12px",
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
              styles={{ body: { padding: "12px 16px" } }}
            >
                           
              <Row justify="space-between" align="middle">
                               
                <Col>
                                   
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/crm/retail")}
                  >
                    Quay lại Danh sách                  
                  </Button>
                                    <Divider type="vertical" />                 
                  <Title
                    level={4}
                    style={{ margin: 0, display: "inline-block" }}
                  >
                                       
                    {isNew
                      ? "Thêm Khách hàng (Tổ chức)"
                      : `Hồ sơ: ${form.getFieldValue("name") || "..."}`}
                                     
                  </Title>
                                 
                </Col>
                               
                <Col>
                                   
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={loading}
                  >
                    Lưu Hồ sơ                  
                  </Button>
                                 
                </Col>
                             
              </Row>
                         
            </Card>
                     
          </Affix>
                   
          <Content style={{ padding: "12px", paddingTop: "0" }}>
                       
            <Spin spinning={loading} tip="Đang tải...">
                           
              <Card style={{ ...styles.card, margin: "12px 0 0 0" }}>
                               
                <Tabs
                  defaultActiveKey="1"
                  type="card"
                  items={[
                    {
                      key: "1",
                      label: (
                        <Space>
                          <IdcardOutlined />
                          Thông tin Tổ chức
                        </Space>
                      ),
                      children: (
                        <Row gutter={24}>
                               
                          <Col
                            xs={24}
                            md={8}
                            lg={6}
                            style={{ textAlign: "center" }}
                          >
                                   
                            <Form.Item
                              label="Logo Tổ chức"
                              style={{ textAlign: "center" }}
                            >
                                       
                              <Upload
                                action="#"
                                listType="picture-circle"
                                fileList={fileList}
                                maxCount={1}
                                beforeUpload={() => false}
                                onChange={handleUploadChange}
                                onRemove={() => setFileList([])}
                                style={{
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                              >
                                           
                                {fileList.length >= 1 ? null : (
                                  <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Tải ảnh</div>
                                  </div>
                                )}
                                         
                              </Upload>
                                     
                            </Form.Item>
                                   
                            <Form.Item
                              name="customer_code"
                              label="Mã KH (Tự động)"
                            >
                                       
                              <Input placeholder="KH-00X" disabled />           
                                             
                            </Form.Item>
                                 
                          </Col>
                               
                          <Col xs={24} md={16} lg={18}>
                                   
                            <Row gutter={16}>
                                       
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  name="name"
                                  label="Tên Tổ chức"
                                  rules={[{ required: true }]}
                                >
                                  <Input />
                                </Form.Item>
                              </Col>
                                       
                              <Col xs={24} sm={12}>
                                <Form.Item name="tax_code" label="Mã số thuế">
                                  <Input />
                                </Form.Item>
                              </Col>
                                       
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  name="contact_person_name"
                                  label="Người liên hệ chính"
                                >
                                  <Input />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  name="contact_person_phone"
                                  label="SĐT Người liên hệ"
                                >
                                  <Input
                                    placeholder="Vd: 0965.637.788"
                                    onChange={(e) => {
                                      const { value } = e.target;
                                      form.setFieldsValue({
                                        contact_person_phone:
                                          phoneFormatter(value),
                                      });
                                    }}
                                  />
                                </Form.Item>
                              </Col>
                                       
                              <Col xs={24} sm={12}>
                                <Form.Item
                                  name="phone"
                                  label="SĐT Bàn Tổ chức (nếu có)"
                                >
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
                                       
                              <Col xs={24} sm={12}>
                                <Form.Item name="email" label="Email Tổ chức">
                                  <Input type="email" />
                                </Form.Item>
                              </Col>
                              <Col span={24}>
                                <Form.Item
                                  name="address"
                                  label="Địa chỉ Đăng ký"
                                >
                                  <Input />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Col>
                        </Row>
                      ),
                    },
                    {
                      key: "2",
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
                              <Empty description="Khách hàng chưa có lịch sử mua hàng." />
                            ),
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Spin>
          </Content>
        </Form>
      </Layout>
    </ConfigProvider>
  );
};

export default CustomerB2COrgForm;
