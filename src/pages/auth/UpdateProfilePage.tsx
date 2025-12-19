// src/pages/auth/UpdateProfilePage.tsx
import {
  SaveOutlined,
  //   UserOutlined,
  IdcardOutlined,
  //   UploadOutlined,
  //   FileImageOutlined,
  BankOutlined,
  MailOutlined,
  PlusOutlined,
  HeartOutlined,
  DeploymentUnitOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Input,
  Button,
  Affix,
  Card,
  Typography,
  Select,
  Row,
  Col,
  Form,
  App as AntApp,
  DatePicker,
  //   Divider,
  Upload,
  //   Avatar,
  Radio,
  Spin,
} from "antd";
// import dayjs from "dayjs";
import React, { useState, useEffect, useMemo } from "react";
// import { useNavigate } from "react-router-dom";

// import { uploadAvatar, uploadIdentityCard } from "@/services/storageService"; // Giả định
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useBankStore } from "@/features/finance/stores/useBankStore";

const { Content } = Layout;
const { Title, Paragraph } = Typography;
const { TextArea } = Input;

// --- CSS INLINE (Từ Canvas) ---
const styles = {
  profileCard: {
    marginBottom: "16px",
    border: "1.5px solid #d0d7de",
    borderRadius: "8px",
  },
};

// --- HÀM TĨNH (Sửa lỗi SĐT) ---
const phoneFormatter = (value: string | undefined) => {
  if (!value) return "";
  const phoneNumber = value.replace(/[^\d]/g, ""); // Sửa: Định dạng 0901 111 222 (theo yêu cầu)
  const match = phoneNumber.match(/^(\d{0,4})(\d{0,3})(\d{0,3})$/);
  if (!match) return phoneNumber;
  return [match[1], match[2], match[3]].filter(Boolean).join(" ");
};

const maritalStatusOptions = [
  { value: "Độc thân", label: "Độc thân" },
  { value: "Đã kết hôn", label: "Đã kết hôn" },
  { value: "Khác", label: "Khác" },
];
const mockLearningLevels = [
  { value: "dh", label: "Đại học" },
  { value: "cd", label: "Cao đẳng" },
  { value: "thpt", label: "THPT" },
];

// --- COMPONENT CHÍNH ---
const UpdateProfilePage: React.FC = () => {
  const [form] = Form.useForm();
  //   const navigate = useNavigate();
  const { message: antMessage } = AntApp.useApp();
  // Kết nối "Bộ não"
  const { profile, updateProfile, logout } = useAuthStore();
  const [loading, setLoading] = useState(false); // State cho Upload
  const { banks, fetchBanks } = useBankStore();
  const [fileList, setFileList] = useState<any[]>([]);
  const [cccdFiles, setCccdFiles] = useState<{ truoc: any[]; sau: any[] }>({
    truoc: [],
    sau: [],
  });

  // Điền thông tin (Email/Tên) đã có
  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        tenNV: profile.full_name,
        email: profile.email,
      });
    }
  }, [profile, form]);

  // Chuyển đổi banks sang options cho AntD Select
  const bankOptions = useMemo(() => {
    return banks.map((bank) => ({
      value: bank.name, // Lưu tên đầy đủ (Vd: "Vietcombank")
      label: `${bank.short_name} - ${bank.name}`, // Hiển thị (Vd: "VCB - Vietcombank")
    }));
  }, [banks]);

  // Tải danh sách ngân hàng khi component mount
  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleSave = async (values: any) => {
    setLoading(true);
    const msgKey = "update_profile";
    antMessage.loading({ content: "Đang lưu hồ sơ...", key: msgKey });

    try {
      // 1. Tải ảnh (Tạm thời giả lập, Sếp cần tạo Bucket)
      const finalAvatarUrl =
        fileList.length > 0 ? fileList[0].url || fileList[0].thumbUrl : null; // if (fileList.length > 0 && fileList[0].originFileObj) {
      //  finalAvatarUrl = await uploadAvatar(fileList[0].originFileObj as File);
      // }
      // (Tương tự cho CCCD)
      // 2. Chuẩn bị dữ liệu (Khớp với RPC 'update_self_profile')
      const profileData = {
        full_name: values.tenNV,
        dob: values.ngaySinh?.format("YYYY-MM-DD") || null,
        phone: values.sdt?.replace(/\s/g, ""), // Xóa khoảng trắng
        gender: values.gioiTinh,
        cccd: values.cccd,
        cccd_issue_date: values.ngayCapCCCD?.format("YYYY-MM-DD") || null,
        address: values.diaChiThuongTru,
        marital_status: values.tinhTrangHonNhan,
        avatar_url: finalAvatarUrl,
        cccd_front_url: null, // (Tạm thời)
        cccd_back_url: null, // (Tạm thời)
        education_level: values.hocVan,
        specialization: values.chuyenNganh,
        bank_name: values.tenNganHang,
        bank_account_number: values.soTaiKhoan,
        bank_account_name: values.tenChuTaiKhoan,
        hobbies: values.soThich,
        limitations: values.gioiHan,
        strengths: values.soTruong,
        needs: values.nhuCau,
      }; // 3. Gọi "Bộ não"
      await updateProfile(profileData); // BƯỚC 5 (Chờ duyệt)
      antMessage.success({
        content: "Cập nhật thành công! Hồ sơ của Sếp đang chờ Admin duyệt.",
        key: msgKey,
        duration: 5,
      }); // Đăng xuất Sếp ra
      setTimeout(() => {
        logout(); // navigate('/login') sẽ tự động kích hoạt
      }, 5000);
    } catch (error: any) {
      console.error("Lỗi lưu profile:", error);
      antMessage.error({ content: `Lỗi: ${error.message}`, key: msgKey });
      setLoading(false);
    }
  };

  const handleUploadChange = (type: string, { fileList: newFileList }: any) => {
    if (type === "avatar") setFileList(newFileList);
    else if (type === "cccd_truoc")
      setCccdFiles({ ...cccdFiles, truoc: newFileList });
    else if (type === "cccd_sau")
      setCccdFiles({ ...cccdFiles, sau: newFileList });
  };

  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Affix offsetTop={0} style={{ zIndex: 10 }}>
          <Card
            styles={{ body: { padding: "12px 16px" } }}
            style={{ margin: "0 12px" }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0, display: "inline-block" }}>
                  Cập nhật Hồ sơ Nhân viên
                </Title>

                <Paragraph
                  type="secondary"
                  style={{ margin: "0 0 0 8px", display: "inline-block" }}
                >
                  (Sếp cần hoàn tất hồ sơ này để Admin duyệt tài khoản)
                </Paragraph>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  htmlType="submit"
                  loading={loading}
                >
                  Gửi Hồ sơ Chờ duyệt
                </Button>
              </Col>
            </Row>
          </Card>
        </Affix>
        <Content style={{ padding: "0 12px" }}>
          <Spin spinning={loading}>
            <Row gutter={16}>
              <Col span={24}>
                {/* Card 1: Thông tin Cơ bản & HCNS */}
                <Card
                  title={
                    <Title level={5} style={{ margin: 0 }}>
                      <IdcardOutlined /> Thông tin Cơ bản (HCNS)
                    </Title>
                  }
                  style={styles.profileCard}
                >
                  <Row gutter={24}>
                    <Col xs={24} md={8}>
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
                              <div style={{ marginTop: 8 }}>Tải ảnh</div>
                            </div>
                          )}
                        </Upload>
                      </Form.Item>
                      <Form.Item name="maNV" label="Mã NV (Tự động)">
                        <Input placeholder="NV00X" disabled />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={16}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            name="tenNV"
                            label="Họ và Tên"
                            rules={[{ required: true }]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="sdt"
                            label="Số điện thoại"
                            rules={[{ required: true }]}
                          >
                            <Input
                              onChange={(e) => {
                                const { value } = e.target;
                                form.setFieldsValue({
                                  sdt: phoneFormatter(value),
                                });
                              }}
                              placeholder="0901 111 222"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="ngaySinh" label="Ngày sinh">
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="gioiTinh" label="Giới tính">
                            <Radio.Group>
                              <Radio value="Nam">Nam</Radio>
                              <Radio value="Nữ">Nữ</Radio>
                              <Radio value="Khác">Khác</Radio>
                            </Radio.Group>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="cccd"
                            label="Số Căn cước Công dân"
                            rules={[{ required: true }]}
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="ngayCapCCCD" label="Ngày cấp CCCD">
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
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
                        <Col span={12}>
                          <Form.Item
                            name="email"
                            label="Email (Dùng để đăng nhập)"
                          >
                            <Input prefix={<MailOutlined />} disabled />
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item
                            name="diaChiThuongTru"
                            label="Địa chỉ Thường trú"
                          >
                            <Input />
                          </Form.Item>
                        </Col>
                        {/* (Upload CCCD Sếp tự thêm nếu cần) */}
                      </Row>
                    </Col>
                  </Row>
                </Card>
                {/* Card 2: Học vấn & Ngân hàng */}
                <Card
                  title={
                    <Title level={5} style={{ margin: 0 }}>
                      <BankOutlined /> Học vấn & Tài khoản
                    </Title>
                  }
                  style={styles.profileCard}
                >
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Title level={5} style={{ marginBottom: 8 }}>
                        Học vấn
                      </Title>
                      <Form.Item name="hocVan" label="Trình độ Học vấn">
                        <Select
                          options={mockLearningLevels}
                          placeholder="Chọn trình độ..."
                        />
                      </Form.Item>
                      <Form.Item name="chuyenNganh" label="Chuyên ngành">
                        <Input placeholder="Vd: Dược Lâm Sàng..." />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Title level={5} style={{ marginBottom: 8 }}>
                        Tài khoản Ngân hàng
                      </Title>
                      <Form.Item
                        name="tenChuTaiKhoan"
                        label="Tên Chủ tài khoản"
                      >
                        <Input placeholder="Tên trên thẻ (VD: NGUYEN VAN AN)" />
                      </Form.Item>
                      <Form.Item name="soTaiKhoan" label="Số Tài khoản">
                        <Input />
                      </Form.Item>
                      {/* --- SỬA LỖI: Chuyển sang Select --- */}
                      <Form.Item name="tenNganHang" label="Tên Ngân hàng">
                        <Select
                          showSearch // Bật tính năng tìm kiếm
                          placeholder="Tìm hoặc chọn ngân hàng (Vd: VCB)"
                          options={bankOptions}
                          filterOption={(input, option) =>
                            (option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                {/* Card 3: Sở thích & Giá trị Cá nhân */}
                <Card
                  title={
                    <Title level={5} style={{ margin: 0 }}>
                      <HeartOutlined /> Sở thích & Giới hạn Cá nhân
                    </Title>
                  }
                  style={styles.profileCard}
                >
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="soThich"
                        label="Sở thích & Niềm đam mê (Hobbies)"
                        tooltip="Giúp xây dựng hoạt động đội nhóm."
                      >
                        <TextArea
                          rows={4}
                          placeholder="Ví dụ: Cờ vua, yoga, du lịch bụi..."
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        name="gioiHan"
                        label="Giới hạn Cá nhân"
                        tooltip="Thông tin bảo mật cho quản lý/HR."
                      >
                        <TextArea
                          rows={4}
                          placeholder="Ví dụ: Không muốn nhận cuộc gọi công việc sau 9h tối."
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
                {/* Card 4: Năng lực & Nhu cầu */}
                <Card
                  title={
                    <Title level={5} style={{ margin: 0 }}>
                      <DeploymentUnitOutlined /> Năng lực & Nhu cầu Phát triển
                    </Title>
                  }
                  style={styles.profileCard}
                >
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="soTruong"
                        label="Sở trường/Điểm mạnh (Tự kê khai)"
                      >
                        <TextArea
                          rows={4}
                          placeholder="Ví dụ: Dược lâm sàng, Kỹ năng tư vấn, Tinh thần lãnh đạo..."
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        name="nhuCau"
                        label="Nhu cầu Học tập/Phát triển"
                        tooltip="Giúp HR thiết kế lộ trình đào tạo phù hợp."
                      >
                        <TextArea
                          rows={4}
                          placeholder="Ví dụ: Cần học thêm về Quản lý Dự án..."
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          </Spin>
        </Content>
      </Form>
    </Layout>
  );
};

export default UpdateProfilePage;
