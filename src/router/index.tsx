// src/router/index.tsx
import { Navigate, type RouteObject } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import BlankLayout from "@/components/layouts/BlankLayout";
import MainLayout from "@/components/layouts/MainLayout";
import OnboardingLayout from "@/components/layouts/OnboardingLayout";
import LoginPage from "@/pages/auth/LoginPage";
import PendingApprovalPage from "@/pages/auth/PendingApprovalPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import UpdatePasswordPage from "@/pages/auth/UpdatePasswordPage";
import UpdateProfilePage from "@/pages/auth/UpdateProfilePage";
import CustomerB2BPage from "@/pages/crm/CustomerB2BPage";
import CustomerB2COrgForm from "@/pages/crm/CustomerB2COrgForm";
import CustomerB2CPage from "@/pages/crm/CustomerB2CPage";
import AssetManagementPage from "@/pages/finance/AssetManagementPage";
// --- IMPORT TRANG MỚI: HÓA ĐƠN ---
import ChartOfAccountsPage from "@/pages/finance/ChartOfAccountsPage";
import FinanceTransactionPage from "@/pages/finance/FinanceTransactionPage";
import InvoiceListPage from "@/pages/finance/invoices/InvoiceListPage";
import InvoiceVerifyPage from "@/pages/finance/invoices/InvoiceVerifyPage";
import ProductFormPage from "@/pages/inventory/ProductFormPage";
import ProductListPage from "@/pages/inventory/ProductListPage";
import WarehouseInboundPage from "@/pages/inventory/receipt/WarehouseInboundPage";
import WarehouseReceiptPage from "@/pages/inventory/receipt/WarehouseReceiptPage";
import DiscountCodeManagement from "@/pages/marketing/DiscountCodeManagement";
import LoyaltyPolicyPage from "@/pages/marketing/LoyaltyPolicyPage";
import ShippingPartnerPage from "@/pages/partner/ShippingPartnerPage";
import SupplierDetailPage from "@/pages/partners/SupplierDetailPage";
import SupplierListPage from "@/pages/partners/SupplierListPage";
import PurchaseOrderDetail from "@/pages/purchasing/PurchaseOrderDetail";
import PurchaseOrderMasterPage from "@/pages/purchasing/PurchaseOrderMasterPage";
import PrescriptionTemplatePage from "@/pages/quick/PrescriptionTemplatePage";
import VaccinationTemplatePage from "@/pages/quick/VaccinationTemplatePage";
import CreateB2BOrderPage from "@/pages/sales/CreateB2BOrderPage";
import ServicePackagePage from "@/pages/services/ServicePackagePage";
import BankListPage from "@/pages/settings/BankListPage";
import CompanyInfoPage from "@/pages/settings/CompanyInfoPage";
import FundAccountPage from "@/pages/settings/FundAccountPage";
import PermissionPage from "@/pages/settings/PermissionPage";
import SystemSettingsHub from "@/pages/settings/SystemSettingsHub";
import TemplateManagerPage from "@/pages/settings/TemplateManagerPage";
import TransactionCategoryPage from "@/pages/settings/TransactionCategoryPage";
import WarehouseListPage from "@/pages/settings/WarehouseListPage";
// --- HÀM TRỢ GIÚP TẠO PLACEHOLDER ---
const PagePlaceholder = ({ title }: { title: string }) => (
  <div style={{ padding: 20 }}>
    <h2>{title}</h2>
    <p>Chức năng này đang được phát triển...</p>
  </div>
);

const routes: RouteObject[] = [
  // === Layout Chính (ĐƯỢC BẢO VỆ) ===
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          // 1. Trang chủ
          {
            index: true, // Đây là /
            element: <PagePlaceholder title="Trang chủ (Dashboard)" />,
          },

          // 2. Kênh Cửa Hàng
          {
            path: "store/dashboard",
            element: <PagePlaceholder title="Dashboard Cửa hàng" />,
          },
          {
            path: "store/appointments",
            element: <PagePlaceholder title="Đặt Lịch Hẹn" />,
          },
          {
            path: "store/shipping-order",
            element: <PagePlaceholder title="Tạo đơn Gửi Đi" />,
          },
          {
            path: "store/b2c-orders",
            element: <PagePlaceholder title="DS đơn hàng B2C" />,
          },
          {
            path: "store/ecommerce",
            element: <PagePlaceholder title="Kết nối Sàn TMĐT" />,
          },
          {
            path: "store/website/general",
            element: (
              <PagePlaceholder title="Website Bán Lẻ - Thông tin chung" />
            ),
          },
          {
            path: "store/website/config",
            element: <PagePlaceholder title="Website Bán Lẻ - Cấu hình" />,
          },
          {
            path: "store/website/content",
            element: <PagePlaceholder title="Website Bán Lẻ - Nội dung" />,
          },

          // 3. Nghiệp vụ Y Tế
          {
            path: "medical/dashboard",
            element: <PagePlaceholder title="Dashboard Y Tế" />,
          },
          {
            path: "medical/clinic",
            element: <PagePlaceholder title="Phòng Khám" />,
          },
          {
            path: "medical/vaccination",
            element: <PagePlaceholder title="Tiêm Chủng" />,
          },

          // 4. Bán buôn (B2B)
          {
            path: "b2b/dashboard",
            element: <PagePlaceholder title="B2B Sales Dashboard" />,
          },
          {
            path: "b2b/create-order",
            element: <CreateB2BOrderPage />,
          },
          {
            path: "b2b/orders",
            element: <PagePlaceholder title="DS Đơn hàng B2B" />,
          },
          {
            path: "b2b/website/general",
            element: <PagePlaceholder title="Website B2B - Thông tin chung" />,
          },
          {
            path: "b2b/website/config",
            element: <PagePlaceholder title="Website B2B - Cấu hình" />,
          },
          {
            path: "b2b/website/content",
            element: <PagePlaceholder title="Website B2B - Nội dung" />,
          },

          // 5. Combo và Dịch Vụ
          {
            path: "services",
            element: <ServicePackagePage />,
          },

          // 6. Kho - Hàng Hóa
          {
            path: "inventory",
            element: <Navigate to="/inventory/products" replace />,
          },
          { path: "inventory/products", element: <ProductListPage /> },
          { path: "inventory/new", element: <ProductFormPage /> },
          { path: "inventory/edit/:id", element: <ProductFormPage /> },
          {
            path: "inventory/purchase",
            element: <Navigate to="/purchase-orders" replace />,
          },
          {
            path: "inventory/receipt/:poId", // Route động theo PO ID
            element: <WarehouseReceiptPage />,
          },
          {
            path: "inventory/inbound",
            element: <WarehouseInboundPage />,
          },
          {
            path: "inventory/transfer",
            element: <PagePlaceholder title="Chuyển kho" />,
          },
          {
            path: "inventory/stocktake",
            element: <PagePlaceholder title="Kiểm hàng" />,
          },
          {
            path: "inventory/cost-adjustment",
            element: <PagePlaceholder title="Điều chỉnh Giá Vốn" />,
          },

          // =========================================================
          // --- MODULE MUA HÀNG (PURCHASING) ---
          // =========================================================
          {
            path: "purchase-orders",
            children: [
              {
                index: true,
                element: <PurchaseOrderMasterPage />,
              },
              {
                path: "new",
                element: <PurchaseOrderDetail />,
              },
              {
                path: ":id",
                element: <PurchaseOrderDetail />,
              },
            ],
          },

          // 7. Thao tác Nhanh
          {
            path: "quick/product-location",
            element: <PagePlaceholder title="Cài nhanh Vị trí Sản phẩm" />,
          },
          {
            path: "quick/price-edit",
            element: <PagePlaceholder title="Sửa giá Sản Phẩm nhanh" />,
          },
          {
            path: "quick/promo-code",
            element: <PagePlaceholder title="Tạo nhanh Mã Giảm Giá" />,
          },
          {
            path: "quick/prescription-template",
            element: <PrescriptionTemplatePage />,
          },
          {
            path: "quick/vaccination-template",
            element: <VaccinationTemplatePage />,
          },

          // 8. Đối tác
          {
            path: "partners",
            element: <Navigate to="/partners/suppliers" replace />,
          },
          { path: "partners/suppliers", element: <SupplierListPage /> },
          { path: "partners/new", element: <SupplierDetailPage /> },
          { path: "partners/edit/:id", element: <SupplierDetailPage /> },
          { path: "partners/detail/:id", element: <SupplierDetailPage /> },
          {
            path: "partners/shipping",
            element: <ShippingPartnerPage />,
          },

          // 9. Quản lý Khách hàng
          { path: "crm", element: <Navigate to="/crm/retail" replace /> },
          {
            path: "crm/retail",
            element: <CustomerB2CPage />,
          },
          {
            path: "crm/organization/new",
            element: <CustomerB2COrgForm />,
          },
          {
            path: "crm/organization/edit/:id",
            element: <CustomerB2COrgForm />,
          },
          { path: "crm/b2b", element: <CustomerB2BPage /> },

          // 10. Quản lý Marketing
          {
            path: "marketing",
            element: <Navigate to="/marketing/dashboard" replace />,
          },
          {
            path: "marketing/dashboard",
            element: <PagePlaceholder title="Dashboard Marketing" />,
          },
          {
            path: "marketing/campaigns",
            element: <PagePlaceholder title="Quản lý Chiến dịch" />,
          },
          {
            path: "marketing/tools/segmentation",
            element: <PagePlaceholder title="Trình tạo Phân khúc KH" />,
          },
          {
            path: "marketing/tools/library",
            element: <PagePlaceholder title="Thư viện Nội dung" />,
          },
          {
            path: "marketing/tools/promo",
            element: <DiscountCodeManagement />,
          },
          {
            path: "marketing/chatbot",
            element: <PagePlaceholder title="Quản lý Chatbot AI" />,
          },

          // 11. Quản lý Nhân sự
          { path: "hr", element: <Navigate to="/hr/dashboard" replace /> },
          {
            path: "hr/dashboard",
            element: <PagePlaceholder title="Dashboard Nhân sự" />,
          },
          {
            path: "hr/employees",
            element: <PagePlaceholder title="Quản lý Hồ sơ Nhân viên" />,
          },
          {
            path: "hr/contracts",
            element: <PagePlaceholder title="Quản lý Hợp đồng & Giấy tờ" />,
          },
          {
            path: "hr/training",
            element: <PagePlaceholder title="Quản lý Đào tạo" />,
          },
          {
            path: "hr/kpi",
            element: <PagePlaceholder title="Giao việc & KPI" />,
          },
          {
            path: "hr/payroll",
            element: <PagePlaceholder title="Quản lý Lương & Chế Độ" />,
          },

          // 12. Tài Chính & Kế Toán
          {
            path: "finance",
            element: <Navigate to="/finance/dashboard" replace />,
          },
          {
            path: "finance/dashboard",
            element: <PagePlaceholder title="Dashboard Tài chính" />,
          },
          {
            path: "finance/transactions",
            element: <FinanceTransactionPage />,
          },
          {
            path: "finance/debts",
            element: <PagePlaceholder title="Quản lý Công Nợ" />,
          },
          {
            path: "finance/assets",
            element: <AssetManagementPage />,
          },
          {
            path: "finance/reconciliation",
            element: <PagePlaceholder title="Đối Soát Giao Dịch" />,
          },
          {
            path: "finance/accounting/chart-of-accounts",
            element: <ChartOfAccountsPage />,
          },
          {
            path: "finance/accounting/journal",
            element: <PagePlaceholder title="Sổ Nhật ký Chung" />,
          },
          {
            path: "finance/accounting/misa-integration",
            element: <PagePlaceholder title="Tích hợp MISA" />,
          },

          // --- CẬP NHẬT: KHO HÓA ĐƠN SỐ & SCAN AI ---
          {
            path: "finance/invoices",
            element: <InvoiceListPage />,
          },
          {
            path: "finance/invoices/verify/:id",
            element: <InvoiceVerifyPage />, // Trang đối chiếu AI
          },
          // ------------------------------------------

          // 13. Báo Cáo
          {
            path: "reports",
            element: <Navigate to="/reports/sales/overview" replace />,
          },
          {
            path: "reports/sales/overview",
            element: <PagePlaceholder title="Báo cáo Bán hàng" />,
          },
          {
            path: "reports/sales/profit-loss",
            element: <PagePlaceholder title="Báo cáo Lãi - Lỗ" />,
          },
          {
            path: "reports/sales/marketing",
            element: <PagePlaceholder title="Báo cáo Marketing" />,
          },
          {
            path: "reports/ops/inventory",
            element: <PagePlaceholder title="Báo cáo Kho" />,
          },
          {
            path: "reports/ops/purchase",
            element: <PagePlaceholder title="Báo cáo Nhập hàng" />,
          },
          {
            path: "reports/ops/crm",
            element: <PagePlaceholder title="Báo cáo Chăm sóc KH" />,
          },
          {
            path: "reports/admin/hr",
            element: <PagePlaceholder title="Báo cáo Nhân viên & KPI" />,
          },
          {
            path: "reports/admin/tasks",
            element: <PagePlaceholder title="Báo cáo Tiến độ Công việc" />,
          },
          {
            path: "reports/finance/cashflow",
            element: <PagePlaceholder title="Sổ quỹ" />,
          },
          {
            path: "settings",
            element: <SystemSettingsHub />,
          },
          { path: "settings/warehouses", element: <WarehouseListPage /> },
          {
            path: "settings/users-roles",
            element: <PermissionPage />,
          },
          {
            path: "settings/business/general",
            element: <CompanyInfoPage />,
          },
          {
            path: "settings/business/operations",
            element: <WarehouseListPage />,
          },
          {
            path: "settings/business/sales",
            element: <PagePlaceholder title="Cấu hình Kinh Doanh" />,
          },
          {
            path: "settings/business/loyalty",
            element: <LoyaltyPolicyPage />,
          },
          {
            path: "settings/business/finance/accounts",
            element: <FundAccountPage />,
          },
          {
            path: "settings/business/finance/categories",
            element: <TransactionCategoryPage />,
          },
          {
            path: "settings/business/finance/banks",
            element: <BankListPage />,
          },
          {
            path: "settings/business/finance/recurring",
            element: <PagePlaceholder title="Quản lý Thu - Chi tự động" />,
          },
          {
            path: "settings/business/hr",
            element: <PagePlaceholder title="Cấu hình Hành Chính - NS" />,
          },
          {
            path: "settings/templates",
            element: <TemplateManagerPage />,
          },
          {
            path: "settings/audit-log",
            element: <PagePlaceholder title="Nhật ký Hệ thống" />,
          },
          {
            path: "products",
            element: <div>TRANG QUẢN LÝ SẢN PHẨM (CŨ)</div>,
          },
        ],
      },
    ],
  },

  // === Layout Tràn Màn hình (POS) ===
  {
    path: "/blank",
    element: <ProtectedRoute />,
    children: [
      {
        element: <BlankLayout />,
        children: [
          {
            path: "pos",
            element: <PagePlaceholder title="TRANG BÁN HÀNG POS" />,
          },
        ],
      },
    ],
  },

  // === Layout Xác thực (Login/Register) ===
  {
    path: "/auth",
    element: <BlankLayout />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
    ],
  },
  // === Layout Onboarding ===
  {
    path: "/onboarding",
    element: <ProtectedRoute />,
    children: [
      {
        element: <OnboardingLayout />,
        children: [
          {
            path: "update-password",
            element: <UpdatePasswordPage />,
          },
          {
            path: "update-profile",
            element: <UpdateProfilePage />,
          },
          {
            path: "pending-approval",
            element: <PendingApprovalPage />,
          },
        ],
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];

export default routes;
