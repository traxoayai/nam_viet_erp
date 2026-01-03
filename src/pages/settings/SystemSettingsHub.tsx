// src/pages/settings/SystemSettingsHub.tsx
import {
  UserSwitchOutlined,
  SettingOutlined,
  DollarCircleOutlined,
  BankOutlined,
  SolutionOutlined,
  FileImageOutlined,
  HistoryOutlined,
  HomeOutlined,
  PercentageOutlined,
  ImportOutlined,
  StarOutlined,
  WalletOutlined,
  AccountBookOutlined,
  FileTextOutlined,
  AimOutlined,
  RightOutlined,
  ShopOutlined,
  SyncOutlined, // Thêm icon
} from "@ant-design/icons";
import {
  Card,
  Typography,
  List,
  Avatar,
  Row,
  Col,
  Grid,
  App as AntApp,
} from "antd";
import React from "react";
import { useNavigate } from "react-router-dom"; // Dùng useNavigate

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// --- DỮ LIỆU CHO CÁC NHÓM CẤU HÌNH ---
// (Em đã cập nhật 'link' để khớp 100% với Router của Sếp)

// Nhóm 1: Quản trị Truy cập
const accessControlSettings = [
  {
    icon: <UserSwitchOutlined />,
    title: "Quản lý Người dùng & Phân quyền",
    description:
      "Tạo Vai trò (Dược sĩ, Kế toán...) và gán quyền cho nhân viên.",
    link: "/settings/users-roles", // Đã khớp
  },
];

// Nhóm 2 - Cấu hình Nghiệp vụ
const generalSettings = [
  {
    icon: <SettingOutlined />,
    title: "Cấu hình Chung",
    description: "CRUD cho thông tin công ty, logo, thuế.",
    link: "/settings/business/general", // Đã khớp
  },
];
const operationSettings = [
  {
    icon: <HomeOutlined />,
    title: "Kho hàng & Chi nhánh",
    description: "CRUD cho các địa điểm kho và chi nhánh kinh doanh.",
    link: "/settings/business/operations",
  },
  // [NEW] Thêm mục này vào
  {
    icon: <ImportOutlined />, // Nhớ import icon nhé
    title: "Nhập Tồn Đầu Kỳ (Sapo Migration)",
    description: "Công cụ hỗ trợ chuyển đổi dữ liệu kho từ hệ thống cũ.",
    link: "/settings/opening-stock",
  },
];
const businessSettings = [
  {
    icon: <DollarCircleOutlined />,
    title: "Bảng Giá",
    description: "CRUD cho Bảng Giá (Bán lẻ, B2B-VIP...).",
    link: "/settings/business/sales", // Đã khớp
  },
  {
    icon: <StarOutlined />,
    title: "Chính sách Tích Điểm",
    description: "Cài đặt quy tắc đổi điểm sang voucher.",
    link: "/settings/business/loyalty", // (Cần tạo route này sau)
  },
  {
    icon: <PercentageOutlined />,
    title: "Chính sách Chiết khấu",
    description: "Cài đặt 'cỗ máy' chiết khấu đầu ra tự động.",
    link: "/settings/business/discounts", // (Cần tạo route này sau)
  },
  {
    icon: <ShopOutlined />,
    title: "Kênh Bán hàng",
    description: "Cài đặt kết nối Shopee, Lazada...",
    link: "/store/ecommerce", // (Trỏ về module Sàn TMĐT)
  },
];
const financialSettings = [
  {
    icon: <BankOutlined />,
    title: "Danh sách Ngân hàng (VietQR)",
    description: "CRUD cho danh sách ngân hàng VietQR.",
    link: "/settings/business/finance/banks", // Đã khớp
  },
  {
    icon: <WalletOutlined />,
    title: "Loại Thu – Chi",
    description: "CRUD cho các lý do (Chi Lương, Chi VPP...).",
    link: "/settings/business/finance/categories", // Đã khớp
  },
  {
    icon: <AccountBookOutlined />,
    title: "Tài Khoản/Quỹ Tiền",
    description: "CRUD cho Quỹ tiền mặt, TK Vietcombank...",
    link: "/settings/business/finance/accounts", // Đã khớp
  },
  {
    icon: <SyncOutlined />,
    title: "Giao dịch Lặp lại",
    description: "Cài đặt các phiếu thu/chi tự động hàng tháng.",
    link: "/settings/business/finance/recurring", // Đã khớp
  },
];
const hrSettings = [
  {
    icon: <SolutionOutlined />,
    title: "Chính sách Lương",
    description: "CRUD cho các Bậc lương, phụ cấp...",
    link: "/settings/business/hr", // Đã khớp (trỏ về placeholder)
  },
  {
    icon: <AimOutlined />,
    title: "Quy tắc Hoa hồng (KPIs)",
    description: "Gán % thưởng cho các KPI hệ thống.",
    link: "/settings/business/hr", // (Sẽ tách ra sau)
  },
  {
    icon: <FileTextOutlined />,
    title: "Các loại Hợp Đồng",
    description: "Định nghĩa HĐ Thử việc, HĐ 1 năm...",
    link: "/settings/business/hr", // (Sẽ tách ra sau)
  },
];

// Nhóm 3
const templateSettings = [
  {
    icon: <FileImageOutlined />,
    title: "Quản lý Mẫu & Biểu mẫu",
    description: "'Xưởng thiết kế' để Sếp tạo, sửa mẫu in Hóa đơn, Báo giá...",
    link: "/settings/templates", // Đã khớp
  },
];

// Nhóm 4
const logSettings = [
  {
    icon: <HistoryOutlined />,
    title: "Nhật ký Hệ thống",
    description: "'Hộp đen' xem và truy vết toàn bộ lịch sử hoạt động.",
    link: "/settings/audit-log", // Đã khớp
  },
];

// --- COMPONENT CHÍNH ---
const SystemSettingsHub: React.FC = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  // Hàm render chung cho các List
  const renderSettingList = (data: any[]) => (
    <List
      itemLayout="horizontal"
      dataSource={data}
      renderItem={(item) => (
        <List.Item
          onClick={() => {
            // Kiểm tra link placeholder (tạm thời)
            if (
              item.link.includes("placeholder") ||
              item.link === "/settings/business/sales" ||
              item.link === "/settings/business/loyalty" ||
              item.link === "/settings/business/discounts" ||
              item.link === "/settings/business/hr"
            ) {
              message.info(`Chức năng "${item.title}" đang được phát triển.`);
            }
            navigate(item.link);
          }}
          style={{
            cursor: "pointer",
            padding: "12px 16px", // Giảm padding
          }}
          className="clickable-list-item" // Class cho hover
          extra={<RightOutlined style={{ color: "#8b949e" }} />}
        >
          <List.Item.Meta
            avatar={
              <Avatar
                icon={item.icon}
                style={{
                  backgroundColor: "rgba(87, 106, 230, 0.1)",
                  color: "#576ae6",
                }}
              />
            }
            title={
              <Text strong style={{ fontSize: "15px" }}>
                {item.title}
              </Text>
            }
            description={<Text type="secondary">{item.description}</Text>}
          />
        </List.Item>
      )}
    />
  );

  // Hàm render cho Nhóm Nghiệp vụ (Phân chia bằng Tiêu Đề và ĐÃ NÂNG CẤP HIGHLIGHT)
  const renderBusinessGroup = () => (
    <>
      {/* 1. Cấu hình Chung & Vận Hành */}
      <Typography.Title
        level={5}
        style={{
          padding: "8px 16px",
          margin: 0,
          backgroundColor: "#8dbff2ff", // <-- HIGHLIGHT
          borderBottom: "1.5px solid #d0d7de", // <-- Github-style border
        }}
      >
        Cấu hình Chung & Vận Hành
      </Typography.Title>
      {renderSettingList(generalSettings)}
      {renderSettingList(operationSettings)}

      {/* 2. Cấu hình Kinh Doanh */}
      <Typography.Title
        level={5}
        style={{
          padding: "8px 16px",
          margin: 0,
          backgroundColor: "#8dbff2ff", // <-- HIGHLIGHT
          borderBottom: "1.5px solid #d0d7de",
          borderTop: "1.5px solid #d0d7de", // Thêm viền trên
        }}
      >
        Cấu hình Kinh Doanh
      </Typography.Title>
      {renderSettingList(businessSettings)}

      {/* 3. Cấu hình Tài Chính */}
      <Typography.Title
        level={5}
        style={{
          padding: "8px 16px",
          margin: 0,
          backgroundColor: "#8dbff2ff", // <-- HIGHLIGHT
          borderBottom: "1.5px solid #d0d7de",
          borderTop: "1.5px solid #d0d7de", // Thêm viền trên
        }}
      >
        Cấu hình Tài Chính
      </Typography.Title>
      {renderSettingList(financialSettings)}

      {/* 4. Cấu hình Hành Chính - Nhân Sự */}
      <Typography.Title
        level={5}
        style={{
          padding: "8px 16px",
          margin: 0,
          backgroundColor: "#8dbff2ff", // <-- HIGHLIGHT
          borderBottom: "1.5px solid #d0d7de",
          borderTop: "1.5px solid #d0d7de", // Thêm viền trên
        }}
      >
        Cấu hình Hành Chính - Nhân Sự
      </Typography.Title>
      {renderSettingList(hrSettings)}
    </>
  );

  return (
    <>
      {/* Thêm CSS cho hiệu ứng hover (Tối ưu UI) */}
      <style>{`
        .clickable-list-item:hover {
          background-color: #f6f8fa; // Nền xám nhạt khi hover
        }
        .ant-list-item {
            border-block-end: 1.5px solid #d0d7de !important; // Viền đậm cho item
        }
        .ant-list-item:last-child {
            border-block-end: none !important; // Bỏ viền cho item cuối
        }
      `}</style>

      {/* TỐI ƯU UI: Bỏ Layout, dùng Content, giới hạn chiều rộng */}
      <div
        style={{
          padding: screens.md ? "8px" : "8px",
          maxWidth: "1012px", // Chiều rộng chuẩn của Github
          margin: "0 auto",
        }}
      >
        <Title level={3} style={{ margin: "12px 0 16px 0" }}>
          Trung tâm Cấu hình Hệ thống
        </Title>

        {/* NÂNG CẤP LAYOUT: 2 CỘT CHO DESKTOP */}
        <Row gutter={[16, 16]}>
          {/* Cột Trái */}
          <Col xs={24} md={12}>
            {/* Nhóm 1: Quản trị Truy cập */}
            <Card
              title={
                <Title
                  level={4}
                  style={{
                    padding: "10px 10px",
                    margin: 0,
                    backgroundColor: "#b5f3d9ff", // <-- HIGHLIGHT NỀN
                  }}
                >
                  Quản trị Truy cập
                </Title>
              }
              variant="outlined" // <-- Github-style
              style={{ marginBottom: "16px" }}
              bodyStyle={{ padding: "0px" }}
            >
              {renderSettingList(accessControlSettings)}
            </Card>

            {/* Nhóm 3: Mẫu & Biểu mẫu */}
            <Card
              title={
                <Title
                  level={4}
                  style={{
                    padding: "10px 10px",
                    margin: 0,
                    backgroundColor: "#b5f3d9ff", // <-- HIGHLIGHT NỀN
                  }}
                >
                  Mẫu & Biểu mẫu
                </Title>
              }
              variant="outlined" // <-- Github-style
              style={{ marginBottom: "16px" }}
              bodyStyle={{ padding: "0px" }}
            >
              {renderSettingList(templateSettings)}
            </Card>

            {/* Nhóm 4: Giám sát Hệ thống */}
            <Card
              title={
                <Title
                  level={4}
                  style={{
                    padding: "10px 10px",
                    margin: 0,
                    backgroundColor: "#b5f3d9ff", // <-- HIGHLIGHT NỀN
                  }}
                >
                  Giám sát Hệ thống
                </Title>
              }
              variant="outlined" // <-- Github-style
              style={{ marginBottom: "16px" }}
              bodyStyle={{ padding: "0px" }}
            >
              {renderSettingList(logSettings)}
            </Card>
          </Col>

          {/* Cột Phải */}
          <Col xs={24} md={12}>
            {/* Nhóm 2: Cấu hình Nghiệp vụ */}
            <Card
              title={
                <Title
                  level={4}
                  style={{
                    padding: "10px 10px",
                    margin: 0,
                    backgroundColor: "#b5f3d9ff", // <-- HIGHLIGHT NỀN
                  }}
                >
                  Cấu hình Nghiệp vụ
                </Title>
              }
              variant="outlined" // <-- Github-style
              style={{ marginBottom: "16px" }}
              bodyStyle={{ padding: 0 }}
            >
              {renderBusinessGroup()}
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default SystemSettingsHub;
