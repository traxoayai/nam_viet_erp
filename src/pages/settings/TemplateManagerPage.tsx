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
import {
  Input,
  Table,
  Button,
  Card,
  Typography,
  Select,
  Row,
  ConfigProvider,
  TableProps,
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
  Collapse, // Giữ lại cho Hộp công cụ
  Spin,
  Avatar, // Giữ lại cho Card.Meta
} from "antd";
import viVN from "antd/locale/vi_VN";
import React, { useState, useEffect } from "react"; // Sửa: Bỏ useRef

// SỬA LỖI: Import component TextEditor
import TextEditor from "@/shared/ui/common/TextEditor";
import { useTemplateStore } from "@/features/settings/stores/useTemplateStore";
import {
  TemplateRecord,
  DocumentTemplate,
} from "@/features/settings/types/template";

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
  const { message: antMessage } = AntApp.useApp(); // SỬA LỖI: Dùng state để giữ nội dung realtime
  const [realtimeContent, setRealtimeContent] = useState("");

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
        const content = editingRecord.content || "<p></p>";
        form.setFieldsValue({
          ...editingRecord,
          status: editingRecord.status === "active",
          content: content, // Đảm bảo content không bị null
        });
        setRealtimeContent(content); // Đồng bộ state realtime
      } else {
        const content = "<p>Bắt đầu soạn thảo...</p>";
        form.resetFields();
        form.setFieldsValue({
          status: true,
          type: "pdf",
          module: "general",
          content: content,
        });
        setRealtimeContent(content); // Đồng bộ state realtime
      }
    }
  }, [viewMode, editingRecord, form]); // SỬA LỖI: Hàm handleSaveTemplate đầy đủ

  const handleSaveTemplate = async () => {
    const msgKey = "save_template";
    try {
      antMessage.loading({ content: "Đang xử lý...", key: msgKey }); // SỬA LỖI: Đồng bộ State (realtime) -> Form State TRƯỚC KHI validate

      form.setFieldsValue({ content: realtimeContent });

      const values = await form.validateFields();

      const recordToSave = {
        ...values,
        content: realtimeContent, // Đảm bảo lấy content mới nhất
        status: values.status ? "active" : "inactive",
      };

      let success = false;
      if (editingRecord) {
        success = await updateTemplate(editingRecord.id, recordToSave);
        if (success)
          antMessage.success({
            content: `Cập nhật mẫu "${values.name}" thành công!`,
            key: msgKey,
          });
      } else {
        success = await addTemplate(recordToSave);
        if (success)
          antMessage.success({
            content: `Thêm mới mẫu "${values.name}" thành công!`,
            key: msgKey,
          });
      }

      if (success) {
        showList(); // Tự động quay về danh sách
      } else {
        antMessage.error({
          content: "Thao tác thất bại. Tên mẫu có thể đã tồn tại.",
          key: msgKey,
        });
      }
    } catch (info) {
      console.log("Validate Failed:", info);
      antMessage.error({
        content: "Lỗi: Vui lòng kiểm tra các trường bắt buộc!",
        key: msgKey,
      });
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
  }; // --- GIAO DIỆN DANH SÁCH ---

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
        render: (_: any, record: TemplateRecord) => (
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
  }; // --- GIAO DIỆN EDITOR (XƯỞNG THIẾT KẾ) ---

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
                      // SỬA LỖI: Lấy content từ state
                      setPreviewContent(realtimeContent || "Chưa có nội dung.");
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
              {/* --- SỬA LỖI: DÙNG Component Chung --- */}
              <Form.Item
                name="content"
                rules={[
                  {
                    required: true,
                    message: "Nội dung không được để trống!",
                  },
                ]}
              >
                <TextEditor // ref={editorRef} // Không cần ref nữa
                  onRealtimeChange={setRealtimeContent} // Cập nhật state
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
                      <Option value="print">Mẫu In (POS)</Option>{" "}
                      <Option value="pdf">Mẫu PDF (A4)</Option>{" "}
                      <Option value="email">Mẫu Email</Option>
                      <Option value="sms">Mẫu SMS</Option>A
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
                    s
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
