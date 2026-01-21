// src/shared/ui/layouts/MainLayout.tsx
import {
  ShopOutlined,
  ShoppingCartOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  ImportOutlined,
  DownloadOutlined,
  UserOutlined,
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
  UserAddOutlined,
  AreaChartOutlined,
  ApartmentOutlined,
  BankOutlined,
  TeamOutlined,
  GiftOutlined,
  BarcodeOutlined,
  ToolOutlined,
  ScheduleOutlined,
  ExperimentOutlined,
  TruckOutlined,
  LockOutlined,
  IdcardOutlined,
  FilePdfOutlined,
  ProductOutlined,
  //HomeFilled,
  //ShopFilled,
  //ShoppingFilled,
  //ShopFilled,
  //ShoppingFilled,
  ThunderboltOutlined,
  AuditOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import { 
  LogOut, CircleChevronLeft, CircleChevronRight, 
  Home, Store, Stethoscope, Briefcase, Gift, Package, Rocket, 
  Handshake, Users, Megaphone, ClipboardList, CircleDollarSign, 
  PieChart, Settings 
} from "lucide-react";
import {
  Layout,
  Button,
  Grid,
  Menu,
  Avatar,
  Drawer,
  Dropdown,
  type MenuProps,
  App as AntApp,
} from "antd";
import React, { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";

import Logo from "@/assets/logo.png";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { BookingModal } from "@/features/booking/components/BookingModal";
import { useAutoLogout } from "@/shared/hooks/useAutoLogout"; // [NEW]
import { NotificationBell } from "@/features/notifications/components/NotificationBell"; // [NEW]

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid; // Hook kiểm tra kích thước màn hình

type MenuItem = Required<MenuProps>["items"][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return { key, icon, children, label } as MenuItem;
}

const finalMenuItems: MenuItem[] = [
  // 1. Trang chủ
  getItem(<Link to="/">Trang chủ</Link>, "/", <Home size={20} color="#4b5563" strokeWidth={1.5} />),

  // 2. Kênh Cửa Hàng
  getItem("Kênh Cửa Hàng", "store", <Store size={20} color="#4b5563" strokeWidth={1.5} />, [
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
  ]),

  // 3. Nghiệp vụ Y Tế
  getItem("Nghiệp vụ Y Tế", "medical", <Stethoscope size={20} color="#4b5563" strokeWidth={1.5} />, [
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
  ]),

  // 4. Bán buôn
  getItem("Bán buôn (B2B)", "b2b", <Briefcase size={20} color="#4b5563" strokeWidth={1.5} />, [
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
  ]),

  // 5. Combo và Dịch Vụ
  getItem(
    <Link to="/services">Combo và Dịch Vụ</Link>,
    "services",
    <Gift size={20} color="#4b5563" strokeWidth={1.5} />
  ),

  // 6. Kho - Hàng Hóa
  getItem("Kho – Hàng Hóa", "inventory", <Package size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/inventory/products">Danh sách Sản Phẩm</Link>,
      "/inventory/products",
      <ProductOutlined />
    ),
    getItem(
      <Link to="/inventory/purchase">Mua hàng</Link>,
      "/inventory/purchase",
      <ShoppingCartOutlined />
    ),
    // --- MỚI: NHẬP KHO (INBOUND) ---
    getItem(
      <Link to="/inventory/inbound">Nhập Kho</Link>,
      "/inventory/inbound",
      <DownloadOutlined />
    ),
    getItem(
      <Link to="/inventory/outbound">Xuất Kho</Link>,
      "/inventory/outbound",
      <LogOut size={16} /> // Lucide Icon
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
  ]),

  // 7. Thao tác Nhanh
  getItem("Thao tác Nhanh", "quick-actions", <Rocket size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/quick/unit-setup">Cài nhanh Quy Cách (Smart Match)</Link>,
      "/quick/unit-setup",
      <ThunderboltOutlined />
    ),
    getItem(
      <Link to="/quick/price-edit">Sửa giá Sản Phẩm nhanh</Link>,
      "/quick/price-edit",
      <DollarCircleOutlined />
    ),
    getItem(
      <Link to="/quick/min-max">Cài Min/Max & Tồn kho (Voice)</Link>,
      "/quick/min-max",
      <AudioOutlined />
    ),
    getItem(
      <Link to="/quick/product-location">Cài nhanh Vị trí Sản phẩm</Link>,
      "/quick/product-location",
      <BarcodeOutlined />
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
  ]),

  // 8. Đối tác
  getItem("Đối tác", "partners", <Handshake size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/partners/suppliers">Nhà Cung Cấp</Link>,
      "/partners/suppliers",
      <UserAddOutlined />
    ),
    getItem(
      <Link to="/partners/shipping">Đối tác Vận Chuyển</Link>,
      "/partners/shipping",
      <TruckOutlined />
    ),
  ]),

  // 9. CRM
  getItem("Quản lý Khách hàng", "crm", <Users size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/crm/retail">Khách kênh Cửa Hàng</Link>,
      "/crm/retail",
      <ShopOutlined />
    ),
    getItem(<Link to="/crm/b2b">Khách B2B</Link>, "/crm/b2b", <TeamOutlined />),
  ]),

  // 10. Marketing
  getItem("Quản lý Marketing", "marketing", <Megaphone size={20} color="#4b5563" strokeWidth={1.5} />, [
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
        <Link to="/marketing/tools/segmentation">Tạo Phân khúc KH</Link>,
        "/marketing/tools/segmentation"
      ),
      getItem(
        <Link to="/marketing/tools/promo">Tạo Voucher & QR Code</Link>,
        "/marketing/tools/promo"
      ),
           
      getItem(
        <Link to="/marketing/tools/distribution">Phân Phối Voucher</Link>,
        "/marketing/tools/distribution"
      ),
      
      getItem(
        <Link to="/marketing/tools/library">Thư viện Nội dung</Link>,
        "/marketing/tools/library"
      ),
      
    ]),
    getItem(
      <Link to="/marketing/chatbot">Quản lý Chatbot AI</Link>,
      "/marketing/chatbot",
      <GlobalOutlined />
    ),
  ]),

  // 11. Nhân sự
  getItem("Quản lý Nhân sự", "hr", <ClipboardList size={20} color="#4b5563" strokeWidth={1.5} />, [
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
  ]),

  // 12. Tài Chính & Kế Toán (CẬP NHẬT MENU MỚI TẠI ĐÂY)
  getItem("Tài Chính & Kế Toán", "finance", <CircleDollarSign size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/finance/dashboard">Dashboard Tài chính</Link>,
      "/finance/dashboard",
      <AppstoreOutlined />
    ),

    // --- MỤC MỚI: KHO HÓA ĐƠN SỐ ---
    getItem(
      <Link to="/finance/invoices">Kho Hóa Đơn Số (AI Scan)</Link>,
      "/finance/invoices",
      <FilePdfOutlined />
    ),
    // -------------------------------

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
      <Link to="/finance/vat">Quản lý Hóa Đơn VAT (Xuất)</Link>,
      "/finance/vat",
      <ContainerOutlined />
    ),
  ]),

  // 13. Báo Cáo
  getItem("Báo Cáo", "reports", <PieChart size={20} color="#4b5563" strokeWidth={1.5} />, [
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
  ]),

  // 14. Cấu hình (Đã nâng cấp thành Submenu)
  getItem("Cấu hình hệ thống", "settings-group", <Settings size={20} color="#4b5563" strokeWidth={1.5} />, [
    getItem(
      <Link to="/settings">Tổng quan Cấu hình</Link>,
      "/settings",
      <AppstoreOutlined />
    ),
    // [NEW] Nút Nhập Tồn Đầu Kỳ (Shortcut)
    getItem(
      <Link to="/settings/opening-stock">Nhập Tồn Đầu Kỳ</Link>,
      "/settings/opening-stock",
      <ImportOutlined />
    ),
  ]),
];

// 1. ĐỊNH NGHĨA QUYỀN TRUY CẬP CHO TỪNG MENU (Dựa trên SQL Core cung cấp)
// Key của Menu => Permission Key trong DB
const MENU_PERMISSIONS: Record<string, string> = {
  // --- KHO ---
  '/inventory/products': 'inv-product-view',
  '/inventory/purchase': 'inv-po-create',
  '/inventory/stocktake': 'inv-count-create',
  
  // --- TÀI CHÍNH (ĐÃ SỬA ĐỔI) ---
  '/finance/dashboard': 'finance.view',     // [FIX] Dùng quyền view
  '/finance/transactions': 'finance.view',  // [FIX] Dùng quyền view (thay vì fin-approve-cash)
  '/finance/debts': 'finance.view',         // [FIX] Dùng quyền view
  
  // --- CẤU HÌNH ---
  'settings-group': 'settings', 
};


const MainLayout: React.FC = () => {
  useAutoLogout(); // [NEW] Kích hoạt bảo vệ 
  const screens = useBreakpoint(); // Kiểm tra màn hình (xs, sm, md...)
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false); // State cho Mobile Drawer
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const location = useLocation(); // Để active menu đúng
  const { user, profile, logout, permissions } = useAuthStore();

  // 2. HÀM LỌC MENU ĐỆ QUY (QUAN TRỌNG)
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .map((item) => {
        // 1. Copy item để tránh mutate
        const newItem = { ...item } as any;

        // 2. Nếu có con, lọc con trước (Đệ quy)
        if (newItem.children && newItem.children.length > 0) {
          newItem.children = filterMenuItems(newItem.children);
          
          // [QUAN TRỌNG] Nếu lọc xong mà rỗng con -> Ẩn luôn cha
          if (newItem.children.length === 0) {
            return null;
          }
        }

        // 3. Check quyền của chính item này (Nếu có quy định trong MENU_PERMISSIONS)
        const requiredPerm = MENU_PERMISSIONS[newItem.key as string];
        if (requiredPerm) {
           const hasPerm = permissions.includes(requiredPerm) || permissions.includes('admin-all');
           if (!hasPerm) return null; // Không có quyền -> Ẩn
        }

        // 4. Mặc định hiển thị (nếu không dính các case trên)
        return newItem;
      })
      .filter(Boolean) as MenuItem[]; // Loại bỏ các item null
  };

  // Tính toán menu hiển thị thực tế
  const visibleMenuItems = React.useMemo(() => {
     return filterMenuItems(finalMenuItems);
  }, [permissions]); // Chỉ tính lại khi quyền thay đổi

  // Tự động đóng Drawer khi chuyển trang trên mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    message.success("Đã đăng xuất!");
    logout();
  };

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
      danger: true,
    },
  ];

  // Sidebar Content (Tách ra để dùng chung cho cả Sider và Drawer)
  const SidebarContent = (
    <>
      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 10px",
          borderBottom: "1px solid #ffffffff",
        }}
      >
        <img
          src={Logo}
          alt="Logo"
          style={{
            height: 32,
            marginRight: collapsed ? 0 : 8,
            transition: "all 0.2s",
          }}
        />
        {!collapsed && (
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#00b96b",
              whiteSpace: "nowrap",
            }}
          >
            DƯỢC NAM VIỆT
          </span>
        )}
      </div>
      <Menu
        mode="inline"
        defaultSelectedKeys={[location.pathname]}
        defaultOpenKeys={[]} // Không mở sẵn nhóm nào
        items={visibleMenuItems} // (Biến finalMenuItems lấy từ code cũ của Sếp)
        style={{ borderRight: 0 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* 1. SIDEBAR CHO DESKTOP (Ẩn khi màn hình nhỏ) */}
      {screens.md ? (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={290}
          collapsedWidth={55}
          style={{
            background: "#ffffffff",
            borderRight: "1px solid #c0c0c0ff",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            overflowY: "auto",
            overflowX: "hidden",
            zIndex: 10,
          }}
        >
          {SidebarContent}
        </Sider>
      ) : null}

      {/* 2. DRAWER CHO MOBILE (Chỉ hiện khi màn hình nhỏ) */}
      {!screens.md && (
        <Drawer
          placement="left"
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          width={280}
          bodyStyle={{ padding: 0 }}
          closable={false} // Tắt nút X mặc định để tự custom
        >
          {/* Copy SidebarContent nhưng set collapsed = false để luôn hiện logo */}
          <div
            style={{
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
              borderBottom: "0px solid #f0f0f0",
            }}
          >
            <img src={Logo} alt="Logo" style={{ height: 32, marginRight: 8 }} />
            <span
              style={{ fontSize: "16px", fontWeight: 700, color: "#00b96b" }}
            >
              DƯỢC NAM VIỆT
            </span>
          </div>
          <Menu
            mode="inline"
            defaultSelectedKeys={[location.pathname]}
            items={visibleMenuItems}
            style={{ borderRight: 0 }}
          />
        </Drawer>
      )}

      {/* 3. MAIN LAYOUT */}
      <Layout
        style={{
          marginLeft: screens.md ? (collapsed ? 55 : 280) : 0,
          transition: "margin-left 0.1s",
        }}
      >
        <Header
          style={{
            background: "#fff",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            height: 50,
            position: "sticky",
            top: 0,
            zIndex: 9,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {screens.md ? (
              // Nút Toggle cho Desktop
              // Nút Toggle cho Desktop
              <Button
                type="text"
                icon={
                  collapsed ? (
                    <CircleChevronRight color="#4b5563" size={24} strokeWidth={1.5} />
                  ) : (
                    <CircleChevronLeft color="#4b5563" size={24} strokeWidth={1.5} />
                  )
                }
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: "16px", width: 48, height: 48 }}
              />
            ) : (
              // Nút Mở Drawer cho Mobile
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setMobileOpen(true)}
                style={{ fontSize: "16px", width: 48, height: 48 }}
              />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell />
            
            {/* BOOKING BUTTON */}
            <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setIsBookingOpen(true)}
                style={{ borderRadius: 20 }}
            >
                {screens.md ? "Tạo Lịch Hẹn" : "Đặt Lịch"}
            </Button>

            <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
              <Button
                type="text"
                style={{
                  height: "auto",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Avatar
                  src={profile?.avatar_url}
                  icon={<UserOutlined />}
                  size="small"
                />
                {screens.md ? (
                  <span
                    style={{ marginLeft: 8, fontWeight: 500, color: "#333" }}
                  >
                    {profile?.full_name || user?.email || "User"}
                  </span>
                ) : null}
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{ margin: 0, overflow: "initial", background: "#efeded" }}
        >
          {/* Container chính: Trên mobile padding nhỏ (8px), Desktop padding lớn (24px) */}
          <div
            style={{
              padding: screens.md ? 6 : 8,
              minHeight: "calc(100vh - 55px)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
      <BookingModal visible={isBookingOpen} onCancel={() => setIsBookingOpen(false)} />
    </Layout>
  );
};

export default MainLayout;
