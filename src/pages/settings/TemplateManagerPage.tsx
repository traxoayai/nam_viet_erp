// src/pages/settings/TemplateManagerPage.tsx
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  PrinterOutlined,
  MailOutlined,
  MessageOutlined,
  CodeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Editor } from "@tinymce/tinymce-react"; // <-- NÂNG CẤP V400: Import TinyMCE
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  ConfigProvider,
  Col,
  Space,
  Tag,
  Modal,
  Form,
  App as AntApp,
  Tooltip,
  Popconfirm,
  Switch,
  Divider,
  Affix,
  Collapse,
  Avatar,
  Spin,
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect, useRef } from "react";

import type { TableProps } from "antd";

import { useTemplateStore } from "@/stores/useTemplateStore";
import { TemplateRecord, DocumentTemplate } from "@/types/template";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// --- CÁC ĐỊNH NGHĨA (Maps) ---
const statusMap = {
  active: { text: "Đang áp dụng", color: "success" },
  inactive: { text: "Không áp dụng", color: "default" },
};
const typeMap = {
  print: { text: "Mẫu In (POS)", color: "blue", icon: <PrinterOutlined /> },
  pdf: { text: "Mẫu PDF (A4)", color: "red", icon: <FileTextOutlined /> },
  email: { text: "Mẫu Email", color: "gold", icon: <MailOutlined /> },
  sms: { text: "Mẫu SMS", color: "cyan", icon: <MessageOutlined /> },
};
// Dữ liệu Module (từ Lộ trình của Sếp)
const moduleOptions = [
  { value: "pos", label: "Bán hàng POS" },
  { value: "b2b", label: "Bán Buôn (B2B)" },
  { value: "hr", label: "Nhân sự (HCNS)" },
  { value: "appointment", label: "Lịch hẹn" },
  { value: "accounting", label: "Kế toán" },
  { value: "general", label: "Chung / Khác" },
];

// --- COMPONENT CHÍNH ---
const TemplateManagerPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();
  const editorRef = useRef<any>(null); // Ref cho TinyMCE

  const {
    templates,
    loading,
    viewMode,
    editingRecord,
    variables,
    fetchTemplates,
    fetchVariables,
    showEditor,
    showList,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTemplateStore();

  const [previewContent, setPreviewContent] = useState("");
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchVariables();
  }, [fetchTemplates, fetchVariables]);

  useEffect(() => {
    if (viewMode === "editor") {
      if (editingRecord) {
        form.setFieldsValue({
          ...editingRecord,
          status: editingRecord.status === "active",
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: true,
          type: "pdf",
          module: "general",
          content: "<p>Bắt đầu soạn thảo...</p>",
        });
      }
    }
  }, [viewMode, editingRecord, form]);

  const handleSaveTemplate = async () => {
    try {
      const values = await form.validateFields();
      const content = editorRef.current?.getContent() || ""; // Lấy nội dung từ Editor

      const recordToSave = {
        ...values,
        content: content,
        status: values.status ? "active" : "inactive",
      };

      let success = false;
      if (editingRecord) {
        success = await updateTemplate(editingRecord.id, recordToSave);
        if (success)
          antMessage.success(`Cập nhật mẫu "${values.name}" thành công!`);
      } else {
        success = await addTemplate(recordToSave);
        if (success)
          antMessage.success(`Thêm mới mẫu "${values.name}" thành công!`);
      }

      if (!success) {
        antMessage.error("Thao tác thất bại. Tên mẫu có thể đã tồn tại.");
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  const handleDelete = async (record: TemplateRecord) => {
    const success = await deleteTemplate(record);
    if (success) {
      antMessage.success(`Đã xóa mẫu "${record.name}"`);
    } else {
      antMessage.error("Xóa thất bại.");
    }
  };

  const copyVariable = (tag: string) => {
    navigator.clipboard.writeText(tag);
    antMessage.success(`Đã sao chép: ${tag}`);
  };

  // --- GIAO DIỆN DANH SÁCH ---
  const renderListView = () => {
    const columns: TableProps<TemplateRecord>["columns"] = [
      {
        title: "Tên Mẫu / Biểu mẫu",
        dataIndex: "name",
        key: "name",
        render: (text) => <Text strong>{text}</Text>,
      },
      {
        title: "Áp dụng cho Module",
        dataIndex: "module",
        key: "module",
        width: 200,
        render: (module) => {
          const mod = moduleOptions.find((m) => m.value === module);
          return mod ? mod.label : "Không rõ";
        },
      },
      {
        title: "Loại Mẫu",
        dataIndex: "type",
        key: "type",
        width: 150,
        align: "center",
        render: (type: DocumentTemplate["type"]) => {
          const typeInfo = typeMap[type] || {};
          return (
            <Tag icon={typeInfo.icon} color={typeInfo.color}>
              {typeInfo.text}
            </Tag>
          );
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 150,
        align: "center",
        render: (status: "active" | "inactive") => (
          <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
        ),
      },
      {
        title: "Hành động",
        key: "action",
        width: 150,
        align: "center",
        fixed: "right",
        render: (_, record: TemplateRecord) => (
          <Space size="small">
            <Tooltip title="Sửa (Vào Xưởng thiết kế)">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => showEditor(record)}
              />
            </Tooltip>
            <Tooltip title="Xem trước">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => {
                  setPreviewContent(record.content || "Chưa có nội dung.");
                  setIsPreviewVisible(true);
                }}
              />
            </Tooltip>
            <Tooltip title="Xóa">
              <Popconfirm
                title="Sếp chắc chắn muốn xóa?"
                description={`Xóa mẫu "${record.name}"?`}
                onConfirm={() => handleDelete(record)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        ),
      },
    ];

    return (
      <Card variant="outlined" styles={{ body: { padding: 12 } }}>
        <Spin spinning={loading}>
          <Row
            justify="space-between"
            align="middle"
            style={{ marginBottom: 16 }}
          >
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                Quản lý Mẫu & Biểu mẫu
              </Title>
              <Text type="secondary">
                "Xưởng thiết kế" các mẫu Hóa đơn, Hợp đồng, Email...
              </Text>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => showEditor(null)}
              >
                Thêm Mẫu Mới
              </Button>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col flex="auto">
              <Input
                prefix={<SearchOutlined />}
                placeholder="Tìm theo tên mẫu..."
                allowClear
              />
            </Col>
          </Row>
          <Table
            columns={columns}
            dataSource={templates}
            bordered
            rowKey="key"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Spin>
      </Card>
    );
  };

  // --- GIAO DIỆN EDITOR (XƯỞNG THIẾT KẾ) ---
  const renderEditorView = () => {
    return (
      <Form form={form} layout="vertical">
        <Affix offsetTop={40} style={{ zIndex: 10 }}>
          <Card
            variant="outlined"
            style={{
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              borderColor: "#d0d7de",
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
                  {editingRecord
                    ? `Sửa Mẫu: ${editingRecord.name}`
                    : "Tạo Mẫu Mới"}
                </Title>
              </Col>
              <Col>
                <Space>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setPreviewContent(
                        editorRef.current?.getContent() || "Chưa có nội dung."
                      );
                      setIsPreviewVisible(true);
                    }}
                  >
                    Xem trước
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveTemplate}
                    loading={loading}
                  >
                    Lưu Mẫu
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Affix>

        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Card
              variant="outlined"
              styles={{ body: { padding: "12px", background: "#FFF" } }}
            >
              <Card.Meta
                avatar={<Avatar icon={<CodeOutlined />} />}
                title="Trình soạn thảo Nội dung"
                description="Soạn thảo chuyên nghiệp (giống Google Docs) cho mẫu."
                style={{ marginBottom: 16 }}
              />

              {/* --- NÂNG CẤP V400: DÙNG TinyMCE --- */}
              <Form.Item
                name="content" // Vẫn dùng Form.Item để validate
                rules={[
                  {
                    required: true,
                    message: "Nội dung không được để trống!",
                  },
                ]}
              >
                <Editor
                  apiKey="43olap2v6079s7rom3ygnwpn97c9id0i6no92oy1gclp6vg2" // (API Key của TinyMCE)
                  onInit={(editor) => (editorRef.current = editor)}
                  initialValue={
                    editingRecord?.content || "<p>Bắt đầu soạn thảo...</p>"
                  }
                  onEditorChange={(content) => {
                    form.setFieldsValue({ content: content }); // Đồng bộ với Form
                  }}
                  // THAY THẾ TOÀN BỘ KHỐI init={{...}} CŨ BẰNG KHỐI NÀY

                  init={{
                    height: 600,
                    menubar: true,
                    // --- NÂNG CẤP: Lấy toàn bộ plugin từ file PDF Sếp gửi ---
                    plugins: [
                      "advlist",
                      "autolink",
                      "lists",
                      "link",
                      "image",
                      "charmap",
                      "preview",
                      "anchor",
                      "searchreplace",
                      "visualblocks",
                      "code",
                      "fullscreen",
                      "insertdatetime",
                      "media",
                      "table",
                      "code",
                      "help",
                      "wordcount",
                      // Các plugin Premium Sếp được dùng thử [cite: 2036]
                      "checklist",
                      "mediaembed",
                      "casechange",
                      "formatpainter",
                      "pageembed",
                      "powerpaste",
                      "advtable",
                      "ai",
                      "mergetags",
                      "exportpdf",
                      "exportword",
                    ],
                    // --- NÂNG CẤP: Lấy toolbar từ file PDF Sếp gửi ---
                    toolbar:
                      "undo redo | blocks fontfamily fontsize | " +
                      "bold italic underline strikethrough | " +
                      "link image media table mergetags | " +
                      "align lineheight | checklist numlist bullist indent outdent | " +
                      "emoticons charmap | removeformat | code fullscreen preview | help",

                    content_style:
                      "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",

                    // --- NÂNG CẤP: Cấu hình các biến (Merge Tags) ---
                    // (Lấy từ mockVariables trong "canvas")
                    mergetags_list: [
                      {
                        value: "Company.Name",
                        title: "Tên Công ty",
                        menu: [
                          { value: "{TenCongTy}", title: "Tên Công ty" },
                          { value: "{DiaChiCongTy}", title: "Địa chỉ Công ty" },
                          { value: "{MaSoThueCongTy}", title: "MST Công ty" },
                        ],
                      },
                      {
                        value: "User.Name",
                        title: "Người dùng",
                        menu: [
                          { value: "{TenNguoiDung}", title: "Tên Người dùng" },
                          { value: "{TenKhachHang}", title: "Tên Khách hàng" },
                          { value: "{TenNhanVien}", title: "Tên Nhân viên" },
                        ],
                      },
                      {
                        value: "Order.Info",
                        title: "Thông tin Đơn hàng",
                        menu: [
                          { value: "{MaDonHang}", title: "Mã Đơn hàng" },
                          { value: "{NgayTaoDon}", title: "Ngày tạo Đơn" },
                          { value: "{TongTienHang}", title: "Tổng Tiền hàng" },
                          { value: "{ChietKhau}", title: "Chiết khấu" },
                          {
                            value: "{TongThanhToan}",
                            title: "Tổng Thanh toán",
                          },
                          { value: "{SoTienNo}", title: "Số Tiền Nợ" },
                        ],
                      },
                    ],
                  }}
                />
              </Form.Item>
              {/* ------------------------------------- */}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card
              title="Thông tin Mẫu"
              variant="outlined"
              styles={{ body: { padding: "12px 16px" } }}
            >
              <Form.Item
                name="name"
                label="Tên Mẫu (Quản lý)"
                rules={[{ required: true, message: "Vui lòng nhập tên Mẫu!" }]}
              >
                <Input placeholder="Vd: Hóa đơn Bán lẻ (POS - K80)" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="module"
                    label="Áp dụng cho Module"
                    rules={[{ required: true }]}
                  >
                    <Select options={moduleOptions} placeholder="Chọn module" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="type"
                    label="Loại Mẫu"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Chọn loại mẫu">
                      <Option value="print">Mẫu In (POS)</Option>
                      <Option value="pdf">Mẫu PDF (A4)</Option>
                      <Option value="email">Mẫu Email</Option>
                      <Option value="sms">Mẫu SMS</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="status"
                label="Trạng thái"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="Đang áp dụng"
                  unCheckedChildren="Không áp dụng"
                />
              </Form.Item>
            </Card>

            <Card
              title="Hộp công cụ (Biến có sẵn)"
              variant="outlined"
              style={{ marginTop: 16 }}
              bodyStyle={{ padding: 8 }}
            >
              <Paragraph type="secondary" style={{ padding: "0 8px 8px 8px" }}>
                Nhấp vào 'Biến' để sao chép.
              </Paragraph>
              <Collapse accordion ghost>
                {variables.map((group) => (
                  <Panel header={group.label} key={group.key}>
                    <Space wrap>
                      {group.tags.map((tag) => (
                        <Tag
                          key={tag}
                          onClick={() => copyVariable(tag)}
                          style={{ cursor: "pointer", userSelect: "all" }}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </Panel>
                ))}
              </Collapse>
            </Card>
          </Col>
        </Row>
      </Form>
    );
  };

  return (
    <ConfigProvider locale={viVN}>
      {/* CSS Toàn cục */}
      <style>{`
        .clickable-list-item:hover {
          background-color: #f6f8fa;
        }
        .ant-table-cell .ant-tag {
          margin: 0;
        }
        /* Style cho ReactQuill (Giữ lại để tương lai Sếp có thể đổi) */
        .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          border-color: #d0d7de !important;
          background-color: #f6f8fa;
        }
        .ql-container {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          border-color: #d0d7de !important;
          font-size: 14px;
        }
        .ql-editor {
          min-height: 540px;
        }
      `}</style>

      {viewMode === "list" ? renderListView() : renderEditorView()}

      {/* Modal Xem trước Nội dung */}
      <Modal
        title="Xem trước Nội dung Mẫu"
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={[
          <Button key="back" onClick={() => setIsPreviewVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={800}
      >
        <Card
          style={{ marginTop: 16, borderColor: "#d0d7de", minHeight: 400 }}
          bodyStyle={{ padding: 16 }}
        >
          <div dangerouslySetInnerHTML={{ __html: previewContent }} />
        </Card>
      </Modal>
    </ConfigProvider>
  );
};

export default TemplateManagerPage;
