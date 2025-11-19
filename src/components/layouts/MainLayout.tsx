// src/components/layouts/MainLayout.tsx
// (ĐÃ NÂNG CẤP V400: Sửa Lỗi 3 - Hiển thị Tên User và Thêm Menu)
import {
  // --- Icons CŨ Sếp đã có ---
  HomeOutlined,
  ShopOutlined,
  HeartOutlined,
  ShoppingCartOutlined,
  DropboxOutlined,
  ContactsOutlined,
  BulbOutlined,
  AuditOutlined,
  AccountBookOutlined,
  LineChartOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  AppstoreOutlined,
  SolutionOutlined,
  WalletOutlined,
  ContainerOutlined,
  GlobalOutlined,
  MedicineBoxOutlined,
  SendOutlined,
  PlusOutlined,
  StockOutlined,
  DollarCircleOutlined,
  DatabaseOutlined,
  AreaChartOutlined,
  ApartmentOutlined,
  BankOutlined,
  TeamOutlined,
  GiftOutlined,
  RocketOutlined,
  BarcodeOutlined,
  ToolOutlined,
  ScheduleOutlined,
  ExperimentOutlined,
  TruckOutlined, // --- Icons MỚI (Cho Menu Dropdown) ---
  LockOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Button,
  Menu,
  Avatar,
  Badge,
  Dropdown,
  // SỬA: Sẽ đổi sang AntApp
  type MenuProps,
  App as AntApp, // SỬA: Dùng AntApp
} from "antd";
import React, { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom"; // SỬA: Thêm useNavigate

import Logo from "@/assets/logo.png";
// XÓA: import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/stores/useAuthStore"; // SỬA: Sửa đường dẫn

const { Header, Sider, Content } = Layout;

// --- MỚI: Định nghĩa kiểu MenuItem ---
type MenuItem = Required<MenuProps>["items"][number];

// --- MỚI: Hàm trợ giúp tạo Item cho Menu ---
function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem;
}

// --- Cấu trúc Menu 14 mục của Sếp (GIỮ NGUYÊN) ---
const finalMenuItems: MenuItem[] = [
  // 1. Trang chủ
  getItem(<Link to="/">Trang chủ</Link>, "/", <HomeOutlined />), // 2. Kênh Cửa Hàng
  getItem("Kênh Cửa Hàng", "store", <ShopOutlined />, [
    getItem(
      <Link to="/store/dashboard">Dashboard Cửa hàng</Link>,
      "/store/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/store/appointments">Đặt Lịch Hẹn</Link>,
      "/store/appointments",
      <ScheduleOutlined />
    ),
    getItem(
      <Link to="/blank/pos">Tạo đơn tại Cửa Hàng [POS]</Link>,
      "/blank/pos",
      <WalletOutlined />
    ),
    getItem(
      <Link to="/store/shipping-order">Tạo đơn Gửi Đi</Link>,
      "/store/shipping-order",
      <SendOutlined />
    ),
    getItem(
      <Link to="/store/b2c-orders">DS đơn hàng B2C</Link>,
      "/store/b2c-orders",
      <ContainerOutlined />
    ),
    getItem(
      <Link to="/store/ecommerce">Kết nối Sàn TMĐT</Link>,
      "/store/ecommerce",
      <GlobalOutlined />
    ),
    getItem("Quản lý Website Bán Lẻ", "website-retail", <GlobalOutlined />, [
      getItem(
        <Link to="/store/website/general">Thông tin chung</Link>,
        "/store/website/general"
      ),
      getItem(
        <Link to="/store/website/config">Cấu hình Đơn hàng & SP</Link>,
        "/store/website/config"
      ),
      getItem(
        <Link to="/store/website/content">Quản lý Nội dung & CS</Link>,
        "/store/website/content"
      ),
    ]),
  ]), // 3. Nghiệp vụ Y Tế
  getItem("Nghiệp vụ Y Tế", "medical", <HeartOutlined />, [
    getItem(
      <Link to="/medical/dashboard">Dashboard Y Tế</Link>,
      "/medical/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/medical/clinic">Phòng Khám</Link>,
      "/medical/clinic",
      <MedicineBoxOutlined />
    ),
    getItem(
      <Link to="/medical/vaccination">Tiêm Chủng</Link>,
      "/medical/vaccination",
      <ExperimentOutlined />
    ),
  ]), // 4. Bán buôn
  getItem("Bán buôn (B2B)", "b2b", <ShoppingCartOutlined />, [
    getItem(
      <Link to="/b2b/dashboard">Thông tin chung B2B</Link>,
      "/b2b/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/b2b/create-order">Tạo Đơn Hàng B2B</Link>,
      "/b2b/create-order",
      <PlusOutlined />
    ),
    getItem(
      <Link to="/b2b/orders">Danh sách đơn hàng</Link>,
      "/b2b/orders",
      <ContainerOutlined />
    ),
    getItem("Website B2B", "website-b2b", <GlobalOutlined />, [
      getItem(
        <Link to="/b2b/website/general">Thông tin chung</Link>,
        "/b2b/website/general"
      ),
      getItem(
        <Link to="/b2b/website/config">Cấu hình Đơn hàng & SP</Link>,
        "/b2b/website/config"
      ),
      getItem(
        <Link to="/b2b/website/content">Quản lý Nội dung & CS</Link>,
        "/b2b/website/content"
      ),
    ]),
  ]), // 5. Combo và Dịch Vụ
  getItem(
    <Link to="/services">Combo và Dịch Vụ</Link>,
    "services",
    <GiftOutlined />
  ), // 6. Kho - Hàng Hóa
  getItem("Kho – Hàng Hóa", "inventory", <DropboxOutlined />, [
    getItem(
      <Link to="/inventory/products">Danh sách Sản Phẩm</Link>,
      "/inventory/products"
    ),
    getItem(
      <Link to="/inventory/purchase">Mua hàng</Link>,
      "/inventory/purchase",
      <ShoppingCartOutlined />
    ),
    getItem(
      <Link to="/inventory/transfer">Chuyển kho</Link>,
      "/inventory/transfer",
      <SendOutlined />
    ),
    getItem(
      <Link to="/inventory/stocktake">Kiểm hàng</Link>,
      "/inventory/stocktake",
      <AuditOutlined />
    ),
    getItem(
      <Link to="/inventory/cost-adjustment">Điều chỉnh Giá Vốn</Link>,
      "/inventory/cost-adjustment",
      <DollarCircleOutlined />
    ),
  ]), // 7. Thao tác Nhanh
  getItem("Thao tác Nhanh", "quick-actions", <RocketOutlined />, [
    getItem(
      <Link to="/quick/product-location">Cài nhanh Vị trí Sản phẩm</Link>,
      "/quick/product-location",
      <BarcodeOutlined />
    ),
    getItem(
      <Link to="/quick/price-edit">Sửa giá Sản Phẩm nhanh</Link>,
      "/quick/price-edit",
      <DollarCircleOutlined />
    ),
    getItem(
      <Link to="/quick/promo-code">Tạo nhanh Mã Giảm Giá</Link>,
      "/quick/promo-code",
      <GiftOutlined />
    ),
    getItem(
      <Link to="/quick/prescription-template">Đơn thuốc Mẫu</Link>,
      "/quick/prescription-template",
      <MedicineBoxOutlined />
    ),
    getItem(
      <Link to="/quick/vaccination-template">Phác đồ Tiêm Chủng Mẫu</Link>,
      "/quick/vaccination-template",
      <ExperimentOutlined />
    ),
  ]), // 8. Đối tác
  getItem("Đối tác", "partners", <ContactsOutlined />, [
    getItem(
      <Link to="/partners/suppliers">Nhà Cung Cấp</Link>,
      "/partners/suppliers"
    ),
    getItem(
      <Link to="/partners/shipping">Đối tác Vận Chuyển</Link>,
      "/partners/shipping",
      <TruckOutlined />
    ),
  ]), // 9. Quản lý Khách hàng
  getItem("Quản lý Khách hàng", "crm", <UserOutlined />, [
    getItem(
      <Link to="/crm/retail">Khách kênh Cửa Hàng</Link>,
      "/crm/retail",
      <ShopOutlined />
    ),
    getItem(<Link to="/crm/b2b">Khách B2B</Link>, "/crm/b2b", <TeamOutlined />),
  ]), // 10. Quản lý Marketing
  getItem("Quản lý Marketing", "marketing", <BulbOutlined />, [
    getItem(
      <Link to="/marketing/dashboard">Dashboard Marketing</Link>,
      "/marketing/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/marketing/campaigns">Quản lý Chiến dịch</Link>,
      "/marketing/campaigns",
      <SendOutlined />
    ),
    getItem("Công cụ Marketing", "marketing-tools", <ToolOutlined />, [
      getItem(
        <Link to="/marketing/tools/segmentation">Trình tạo Phân khúc KH</Link>,
        "/marketing/tools/segmentation"
      ),
      getItem(
        <Link to="/marketing/tools/library">Thư viện Nội dung</Link>,
        "/marketing/tools/library"
      ),
      getItem(
        <Link to="/marketing/tools/promo">Mã Giảm giá & QR Code</Link>,
        "/marketing/tools/promo"
      ),
    ]),
    getItem(
      <Link to="/marketing/chatbot">Quản lý Chatbot AI</Link>,
      "/marketing/chatbot",
      <GlobalOutlined />
    ),
  ]), // 11. Quản lý Nhân sự
  getItem("Quản lý Nhân sự", "hr", <AuditOutlined />, [
    getItem(
      <Link to="/hr/dashboard">Dashboard Nhân sự</Link>,
      "/hr/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/hr/employees">Quản lý Hồ sơ Nhân viên</Link>,
      "/hr/employees",
      <UserOutlined />
    ),
    getItem(
      <Link to="/hr/contracts">Quản lý Hợp đồng & Giấy tờ</Link>,
      "/hr/contracts",
      <ContainerOutlined />
    ),
    getItem(
      <Link to="/hr/training">Quản lý Đào tạo</Link>,
      "/hr/training",
      <SolutionOutlined />
    ),
    getItem(
      <Link to="/hr/kpi">Giao việc & KPI</Link>,
      "/hr/kpi",
      <StockOutlined />
    ),
    getItem(
      <Link to="/hr/payroll">Quản lý Lương & Chế Độ</Link>,
      "/hr/payroll",
      <DollarCircleOutlined />
    ),
  ]), // 12. Tài Chính & Kế Toán
  getItem("Tài Chính & Kế Toán", "finance", <AccountBookOutlined />, [
    getItem(
      <Link to="/finance/dashboard">Dashboard Tài chính</Link>,
      "/finance/dashboard",
      <AppstoreOutlined />
    ),
    getItem(
      <Link to="/finance/transactions">Quản lý Thu – Chi</Link>,
      "/finance/transactions",
      <WalletOutlined />
    ),
    getItem(
      <Link to="/finance/debts">Quản lý Công Nợ</Link>,
      "/finance/debts",
      <DollarCircleOutlined />
    ),
    getItem(
      <Link to="/finance/assets">Quản Lý Tài Sản</Link>,
      "/finance/assets",
      <AuditOutlined />
    ),
    getItem(
      <Link to="/finance/reconciliation">Đối Soát Giao Dịch</Link>,
      "/finance/reconciliation",
      <AuditOutlined />
    ),
    getItem("Nghiệp Vụ Kế Toán", "accounting", <ApartmentOutlined />, [
      getItem(
        <Link to="/finance/accounting/chart-of-accounts">
          Hệ thống Tài Khoản
        </Link>,
        "/finance/accounting/chart-of-accounts"
      ),
      getItem(
        <Link to="/finance/accounting/journal">Sổ Nhật ký Chung</Link>,
        "/finance/accounting/journal"
      ),
      getItem(
        <Link to="/finance/accounting/misa-integration">Tích hợp MISA</Link>,
        "/finance/accounting/misa-integration"
      ),
    ]),
    getItem(
      <Link to="/finance/vat">Quản lý Hóa Đơn VAT</Link>,
      "/finance/vat",
      <ContainerOutlined />
    ),
  ]), // 13. Báo Cáo
  getItem("Báo Cáo", "reports", <LineChartOutlined />, [
    getItem("Báo cáo Kinh doanh", "report-sales", <AreaChartOutlined />, [
      getItem(
        <Link to="/reports/sales/overview">Báo cáo Bán hàng</Link>,
        "/reports/sales/overview"
      ),
      getItem(
        <Link to="/reports/sales/profit-loss">Báo cáo Lãi - Lỗ</Link>,
        "/reports/sales/profit-loss"
      ),
      getItem(
        <Link to="/reports/sales/marketing">Báo cáo Marketing</Link>,
        "/reports/sales/marketing"
      ),
    ]),
    getItem("Báo cáo Vận hành", "report-ops", <DatabaseOutlined />, [
      getItem(
        <Link to="/reports/ops/inventory">Báo cáo Kho</Link>,
        "/reports/ops/inventory"
      ),
      getItem(
        <Link to="/reports/ops/purchase">Báo cáo Nhập hàng</Link>,
        "/reports/ops/purchase"
      ),
      getItem(
        <Link to="/reports/ops/crm">Báo cáo Chăm sóc KH</Link>,
        "/reports/ops/crm"
      ),
    ]),
    getItem("Báo cáo Quản trị", "report-admin", <SolutionOutlined />, [
      getItem(
        <Link to="/reports/admin/hr">Báo cáo Nhân viên & KPI</Link>,
        "/reports/admin/hr"
      ),
      getItem(
        <Link to="/reports/admin/tasks">Báo cáo Tiến độ Công việc</Link>,
        "/reports/admin/tasks"
      ),
    ]),
    getItem("Báo cáo Tài chính", "report-finance", <BankOutlined />, [
      getItem(
        <Link to="/reports/finance/cashflow">Sổ quỹ</Link>,
        "/reports/finance/cashflow"
      ),
    ]),
  ]), // 14. Cấu hình hệ thống
  getItem(
    <Link to="/settings">Cấu hình hệ thống</Link>,
    "/settings",
    <SettingOutlined />
  ),
];
// --- KẾT THÚC CẤU TRÚC MENU ---

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { message } = AntApp.useApp(); // SỬA: Thêm AntApp
  const navigate = useNavigate(); // SỬA: Thêm Navigate
  // SỬA LỖI 3: Kết nối đúng store và lấy đúng state

  const { user, profile, logout } = useAuthStore(); // SỬA LỖI 3: Dùng hàm logout từ "Bộ não"

  const handleLogout = () => {
    message.success("Đã đăng xuất!");
    logout(); // Gatekeeper sẽ tự động xử lý việc chuyển hướng
  }; // SỬA LỖI 3: Cập nhật menu items

  const userMenuItems = [
    {
      key: "profile",
      label: "Cập nhật Hồ sơ",
      icon: <IdcardOutlined />,
      onClick: () => navigate("/onboarding/update-profile"),
    },
    {
      key: "password",
      label: "Đổi Mật khẩu",
      icon: <LockOutlined />,
      onClick: () => navigate("/onboarding/update-password"),
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
      danger: true, // Thêm danger cho Đăng xuất
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        collapsedWidth={65}
        width={260}
        style={{
          background: "#ffffffff", // SỬA: Đổi sang nền trắng
          borderRight: "1px solid #e8e8e8ff", // Thêm viền
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: "64px", // SỬA: Đồng bộ 64px
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <img
            src={Logo}
            alt="Logo"
            style={{
              height: 40,
              marginRight: collapsed ? 0 : 8,
              transition: "margin-right 0.2s",
            }}
          />

          {!collapsed && (
            <span
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#00b96b",
              }}
            >
              DƯỢC NAM VIỆT
            </span>
          )}
        </div>

        <Menu // theme="dark" // SỬA: Bỏ theme dark
          mode="inline"
          defaultSelectedKeys={["/"]}
          items={finalMenuItems}
        />
      </Sider>

      <Layout
        style={{
          marginLeft: collapsed ? 65 : 260,
          transition: "margin-left 0.2s",
        }}
      >
        <Header
          style={{
            background: "#fff", // SỬA: Nền trắng
            padding: "0 16px 0 0", // SỬA: Căn chỉnh padding
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0", // SỬA: Thêm viền
            height: 48, // SỬA: Đồng bộ 48px
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: "16px",
                width: 64,
                height: 64,
              }}
            />
            {/* Sếp có thể thêm Breadcrumb ở đây */}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              type="text"
              shape="circle"
              icon={
                <Badge dot>
                  <BellOutlined />
                </Badge>
              }
            />

            <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
              <Button type="text" style={{ height: "auto", padding: "0 8px" }}>
                {/* SỬA LỖI 3: Dùng Avatar từ 'profile' */}

                <Avatar src={profile?.avatar_url} icon={<UserOutlined />} />

                <span style={{ marginLeft: 8, fontWeight: 500, color: "#333" }}>
                  {/* SỬA LỖI 3: Dùng Tên từ 'profile' */}
                  {profile?.full_name || user?.email || "User"}
                </span>
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: 0,
            overflow: "auto",
            background: "#f9f9f9",
            borderRadius: 8,
          }}
        >
          {/* SỬA: Thêm 1 div bọc ngoài với padding */}
          <div style={{ padding: 6, minHeight: "calc(100vh - 96px)" }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
