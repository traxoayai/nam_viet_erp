// import {
//   SearchOutlined,
//   PlusOutlined,
//   DownloadOutlined,
//   UploadOutlined,
//   DownOutlined,
//   EditOutlined,
//   DeleteOutlined,
//   EyeOutlined,
//   MoreOutlined,
//   DollarCircleOutlined,
//   ArrowUpOutlined, // Icon cho Thu
//   ArrowDownOutlined, // Icon cho Chi
// } from "@ant-design/icons";
// import {
//   Layout,
//   Input,
//   Table,
//   Button,
//   Card,
//   Typography,
//   Select,
//   Row,
//   Col,
//   ConfigProvider,
//   Space,
//   Tag,
//   Dropdown,
//   Menu,
//   Alert,
//   Modal,
//   Form,
//   InputNumber,
//   message,
//   Tooltip,
//   Popconfirm,
// } from "antd";
// import viVN from "antd/locale/vi_VN";
// import React, { useState } from "react";
// import "dayjs/locale/vi";

// const { Content } = Layout;
// const { Title, Text } = Typography;
// const { Option } = Select;

// // --- MOCK DATA ---
// const mockTransactionTypes = [
//   {
//     key: "1",
//     code: "THU_BANLE",
//     name: "Doanh thu Bán lẻ (POS)",
//     type: "thu",
//     accountCode: "5111",
//     status: "active",
//     description: "Doanh thu từ bán lẻ tại các nhà thuốc, phòng khám.",
//   },
//   {
//     key: "2",
//     code: "THU_B2B",
//     name: "Doanh thu Bán buôn (B2B)",
//     type: "thu",
//     accountCode: "5112",
//     status: "active",
//     description: "Doanh thu từ bán sỉ cho đối tác B2B.",
//   },
//   {
//     key: "3",
//     code: "CHI_LUONG",
//     name: "Chi Lương Nhân viên",
//     type: "chi",
//     accountCode: "6421",
//     status: "active",
//     description: "Chi phí lương hàng tháng cho nhân viên.",
//   },
//   {
//     key: "4",
//     code: "CHI_VPP",
//     name: "Chi Văn phòng phẩm",
//     type: "chi",
//     accountCode: "6425",
//     status: "active",
//     description: "Chi mua sắm VPP, dụng cụ văn phòng.",
//   },
//   {
//     key: "5",
//     code: "CHI_NHAPHANG",
//     name: "Chi Nhập hàng (TT NCC)",
//     type: "chi",
//     accountCode: "331",
//     status: "active",
//     description: "Chi thanh toán công nợ cho nhà cung cấp.",
//   },
//   {
//     key: "6",
//     code: "CHI_TAMUNG",
//     name: "Tạm ứng Công tác phí",
//     type: "chi",
//     accountCode: "141",
//     status: "active",
//     description: "Tạm ứng tiền cho nhân viên đi công tác.",
//   },
// ];

// // Định nghĩa các loại và trạng thái
// const transactionTypeMap = {
//   thu: { text: "Khoản Thu", color: "success", icon: <ArrowUpOutlined /> },
//   chi: { text: "Khoản Chi", color: "error", icon: <ArrowDownOutlined /> },
// };
// const statusMap = {
//   active: { text: "Đang hoạt động", color: "green" },
//   inactive: { text: "Ngừng hoạt động", color: "red" },
// };
// // Mock danh sách tài khoản kế toán
// const mockAccounts = [
//   { code: "5111", name: "5111 - Doanh thu bán lẻ" },
//   { code: "5112", name: "5112 - Doanh thu bán buôn" },
//   { code: "6421", name: "6421 - Chi phí lương" },
//   { code: "6425", name: "6425 - Chi phí VPP" },
//   { code: "331", name: "331 - Phải trả người bán" },
//   { code: "141", name: "141 - Tạm ứng" },
// ];

// const TransactionTypeListPage = () => {
//   const [selectedRowKeys, setSelectedRowKeys] = useState([]);
//   const [isModalVisible, setIsModalVisible] = useState(false);
//   const [editingType, setEditingType] = useState(null);
//   const [form] = Form.useForm();

//   const onSelectChange = (keys) => {
//     setSelectedRowKeys(keys);
//   };

//   const showAddModal = () => {
//     setEditingType(null);
//     form.resetFields();
//     setIsModalVisible(true);
//   };

//   const showEditModal = (record) => {
//     setEditingType(record);
//     form.setFieldsValue(record);
//     setIsModalVisible(true);
//   };

//   const handleModalClose = () => {
//     setIsModalVisible(false);
//     setEditingType(null);
//     form.resetFields();
//   };

//   const handleModalSave = () => {
//     form
//       .validateFields()
//       .then((values) => {
//         form.resetFields();
//         if (editingType) {
//           message.success(`Cập nhật loại ${values.name} thành công!`);
//         } else {
//           message.success(`Thêm mới loại ${values.name} thành công!`);
//         }
//         setIsModalVisible(false);
//         setEditingType(null);
//         // Cần thêm logic để cập nhật lại bảng `mockTransactionTypes`
//       })
//       .catch((info) => {
//         console.log("Validate Failed:", info);
//       });
//   };

//   const rowSelection = {
//     selectedRowKeys,
//     onChange: onSelectChange,
//   };

//   const hasSelected = selectedRowKeys.length > 0;

//   const columns = [
//     {
//       title: "Mã Loại",
//       dataIndex: "code",
//       key: "code",
//       sorter: (a, b) => a.code.localeCompare(b.code),
//     },
//     {
//       title: "Tên Loại Thu / Chi",
//       dataIndex: "name",
//       key: "name",
//       render: (text) => <Text strong>{text}</Text>,
//     },
//     {
//       title: "Loại",
//       dataIndex: "type",
//       key: "type",
//       align: "center",
//       render: (type) => {
//         const typeInfo = transactionTypeMap[type];
//         return (
//           <Tag color={typeInfo.color} icon={typeInfo.icon}>
//             {typeInfo.text}
//           </Tag>
//         );
//       },
//       filters: Object.keys(transactionTypeMap).map((key) => ({
//         text: transactionTypeMap[key].text,
//         value: key,
//       })),
//       onFilter: (value, record) => record.type === value,
//     },
//     {
//       title: "Tài khoản Kế toán (Gợi ý)",
//       dataIndex: "accountCode",
//       key: "accountCode",
//       render: (code) => <Tag color="blue">{code}</Tag>,
//     },
//     {
//       title: "Mô tả",
//       dataIndex: "description",
//       key: "description",
//     },
//     {
//       title: "Trạng thái",
//       dataIndex: "status",
//       key: "status",
//       align: "center",
//       render: (status) => (
//         <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
//       ),
//       filters: Object.keys(statusMap).map((key) => ({
//         text: statusMap[key].text,
//         value: key,
//       })),
//       onFilter: (value, record) => record.status === value,
//     },
//     {
//       title: "Hành động",
//       key: "action",
//       align: "center",
//       width: 120,
//       render: (_, record) => (
//         <Space>
//           <Tooltip title="Sửa">
//             <Button
//               type="text"
//               icon={<EditOutlined />}
//               onClick={() => showEditModal(record)}
//             />
//           </Tooltip>
//           <Tooltip title="Xóa">
//             <Popconfirm
//               title="Sếp có chắc chắn muốn xóa loại này?"
//               onConfirm={() => message.success(`Đã xóa loại ${record.name}`)}
//               okText="Đồng ý"
//               cancelText="Hủy"
//             >
//               <Button type="text" danger icon={<DeleteOutlined />} />
//             </Popconfirm>
//           </Tooltip>
//         </Space>
//       ),
//     },
//   ];

//   return (
//     <ConfigProvider locale={viVN}>
//       <Card bordered={false}>
//         {/* Phần 1: Header - Tiêu đề và Nút bấm */}
//         <Row
//           justify="space-between"
//           align="middle"
//           style={{ marginBottom: 24 }}
//         >
//           <Col>
//             <Title level={4} style={{ margin: 0 }}>
//               Quản lý Loại Thu - Chi
//             </Title>
//           </Col>
//           <Col>
//             <Space>
//               {/* <Button icon={<DownloadOutlined />}>Xuất Excel</Button> */}
//               <Button
//                 type="primary"
//                 icon={<PlusOutlined />}
//                 onClick={showAddModal}
//               >
//                 Thêm Loại Thu/Chi Mới
//               </Button>
//             </Space>
//           </Col>
//         </Row>

//         {/* Phần 2: Bộ lọc */}
//         <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
//           <Col flex="auto">
//             <Input
//               prefix={<SearchOutlined />}
//               placeholder="Tìm theo Tên, Mã, Tài khoản KT..."
//               allowClear
//             />
//           </Col>
//           <Col>
//             <Select
//               placeholder="Loại (Thu/Chi)"
//               style={{ width: 180 }}
//               allowClear
//               options={Object.keys(transactionTypeMap).map((k) => ({
//                 label: transactionTypeMap[k].text,
//                 value: k,
//               }))}
//             />
//           </Col>
//           <Col>
//             <Select
//               placeholder="Trạng thái"
//               style={{ width: 180 }}
//               allowClear
//               options={Object.keys(statusMap).map((k) => ({
//                 label: statusMap[k].text,
//                 value: k,
//               }))}
//             />
//           </Col>
//         </Row>

//         {/* Thanh Hành động Hàng loạt (xuất hiện khi chọn) */}
//         {hasSelected ? (
//           <Alert
//             message={`${selectedRowKeys.length} loại được chọn`}
//             type="info"
//             showIcon
//             style={{ marginBottom: 16 }}
//             action={
//               <Space>
//                 <Button size="small" danger icon={<DeleteOutlined />}>
//                   Xóa {selectedRowKeys.length} loại
//                 </Button>
//               </Space>
//             }
//           />
//         ) : null}

//         {/* Phần 3: Bảng dữ liệu */}
//         <Table
//           rowSelection={rowSelection}
//           columns={columns}
//           dataSource={mockTransactionTypes}
//           bordered
//           rowKey="key"
//           scroll={{ x: "max-content" }}
//         />

//         {/* Modal để Thêm/Sửa */}
//         <Modal
//           title={
//             editingType
//               ? `Chỉnh sửa: ${editingType.name}`
//               : "Thêm Loại Thu/Chi Mới"
//           }
//           open={isModalVisible}
//           onCancel={handleModalClose}
//           onOk={handleModalSave}
//           okText="Lưu thay đổi"
//           cancelText="Hủy"
//           width={800}
//           destroyOnClose
//         >
//           <Form
//             form={form}
//             layout="vertical"
//             initialValues={{ status: "active", type: "chi" }}
//           >
//             <Row gutter={24}>
//               <Col span={12}>
//                 <Form.Item
//                   name="name"
//                   label="Tên Loại Thu/Chi"
//                   rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
//                 >
//                   <Input />
//                 </Form.Item>
//               </Col>
//               <Col span={6}>
//                 <Form.Item
//                   name="code"
//                   label="Mã (Viết tắt)"
//                   rules={[{ required: true, message: "Vui lòng nhập mã!" }]}
//                   extra="Vd: CHI_LUONG, THU_BANLE"
//                 >
//                   <Input />
//                 </Form.Item>
//               </Col>
//               <Col span={6}>
//                 <Form.Item
//                   name="type"
//                   label="Loại"
//                   rules={[{ required: true }]}
//                 >
//                   <Select
//                     options={Object.keys(transactionTypeMap).map((k) => ({
//                       label: transactionTypeMap[k].text,
//                       value: k,
//                     }))}
//                   />
//                 </Form.Item>
//               </Col>
//               <Col span={12}>
//                 <Form.Item
//                   name="accountCode"
//                   label="Tài khoản Kế toán liên kết (Gợi ý)"
//                   rules={[
//                     { required: true, message: "Vui lòng chọn TK Kế toán!" },
//                   ]}
//                 >
//                   {/* Nâng cấp: Dùng Select.Search để tìm trong danh sách TK Kế toán */}
//                   <Select
//                     showSearch
//                     placeholder="Tìm TK Kế toán (Vd: 5111)"
//                     options={mockAccounts.map((acc) => ({
//                       label: acc.name,
//                       value: acc.code,
//                     }))}
//                     filterOption={(input, option) =>
//                       (option?.label ?? "")
//                         .toLowerCase()
//                         .includes(input.toLowerCase())
//                     }
//                   />
//                 </Form.Item>
//               </Col>
//               <Col span={12}>
//                 <Form.Item
//                   name="status"
//                   label="Trạng thái"
//                   rules={[{ required: true }]}
//                 >
//                   <Select>
//                     <Option value="active">Đang hoạt động</Option>
//                     <Option value="inactive">Ngừng hoạt động</Option>
//                   </Select>
//                 </Form.Item>
//               </Col>
//               <Col span={24}>
//                 <Form.Item name="description" label="Mô tả / Diễn giải">
//                   <Input.TextArea rows={3} />
//                 </Form.Item>
//               </Col>
//             </Row>
//           </Form>
//         </Modal>
//       </Card>
//     </ConfigProvider>
//   );
// };

// export default TransactionTypeListPage;
