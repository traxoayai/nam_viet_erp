// src/app/router/index.tsx
import { Navigate, type RouteObject, Outlet } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import { PermissionGuard } from "@/shared/components/auth/PermissionGuard"; // [NEW]
import { PERMISSIONS } from "@/features/auth/constants/permissions"; // [NEW]

import LoginPage from "@/pages/auth/LoginPage";
import PendingApprovalPage from "@/pages/auth/PendingApprovalPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import UpdatePasswordPage from "@/pages/auth/UpdatePasswordPage";
import UpdateProfilePage from "@/pages/auth/UpdateProfilePage";
import CustomerB2BPage from "@/pages/crm/CustomerB2BPage";
import CustomerB2COrgForm from "@/pages/crm/CustomerB2COrgForm";
import CustomerB2CPage from "@/pages/crm/CustomerB2CPage";
import AssetManagementPage from "@/pages/finance/AssetManagementPage";
import ReceptionPage from "@/pages/medical/ReceptionPage"; // [NEW]
import DoctorPage from "@/pages/medical/DoctorPage";
import DoctorQueuePage from "@/pages/medical/DoctorQueuePage";


import ChartOfAccountsPage from "@/pages/finance/ChartOfAccountsPage";
import FinanceTransactionPage from "@/pages/finance/FinanceTransactionPage";
import InvoiceListPage from "@/pages/finance/invoices/InvoiceListPage";
import InvoiceVerifyPage from "@/pages/finance/invoices/InvoiceVerifyPage";
import ReconciliationPage from "@/pages/finance/ReconciliationPage";	
import ProductFormPage from "@/pages/inventory/ProductFormPage";
import ProductListPage from "@/pages/inventory/ProductListPage";
import WarehouseInboundPage from "@/pages/inventory/receipt/WarehouseInboundPage";
import WarehouseReceiptPage from "@/pages/inventory/receipt/WarehouseReceiptPage";
import WarehouseOutboundPage from "@/pages/inventory/outbound/WarehouseOutboundPage";
import WarehouseOutboundDetailPage from "@/pages/inventory/outbound/WarehouseOutboundDetailPage";
import DiscountCodeManagement from "@/pages/marketing/DiscountCodeManagement";
import LoyaltyPolicyPage from "@/pages/marketing/LoyaltyPolicyPage";
import ShippingPartnerPage from "@/pages/partner/ShippingPartnerPage";
import SupplierDetailPage from "@/pages/partners/SupplierDetailPage";
import SupplierListPage from "@/pages/partners/SupplierListPage";
import SupplierPolicyListPage from "@/pages/partners/policies/SupplierPolicyListPage"; // [NEW]
import SupplierPolicyFormPage from "@/pages/partners/policies/SupplierPolicyFormPage"; // [NEW]
import PurchaseOrderDetail from "@/pages/purchasing/PurchaseOrderDetail";
import PurchaseOrderMasterPage from "@/pages/purchasing/PurchaseOrderMasterPage";
import PurchaseCostingPage from "@/pages/purchasing/PurchaseCostingPage"; // [NEW]
import PrescriptionTemplatePage from "@/pages/quick/PrescriptionTemplatePage";
import VaccinationTemplatePage from "@/pages/quick/VaccinationTemplatePage";
import B2BOrderListPage from "@/pages/sales/B2BOrderListPage";
import B2BOrderDetailPage from "@/pages/sales/B2BOrderDetailPage";
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
import BlankLayout from "@/shared/ui/layouts/BlankLayout";
import MainLayout from "@/shared/ui/layouts/MainLayout";
import OnboardingLayout from "@/shared/ui/layouts/OnboardingLayout";
import TransferListPage from "@/pages/inventory/transfer/TransferListPage";
import TransferDetailPage from "@/pages/inventory/transfer/TransferDetailPage";
import TransferCreatePage from "@/pages/inventory/transfer/TransferCreatePage"; // [NEW]
import CustomerSegmentsPage from "@/pages/crm/CustomerSegmentsPage";
import VoucherDistributionPage from "@/pages/crm/VoucherDistributionPage";
import PosPage from "@/pages/pos/PosPage";
import B2COrderListPage from "@/pages/sales/B2COrderListPage";
import QuickLocationUpdate from "@/pages/quick/QuickLocationUpdate";
import InventoryCheckList from '@/features/inventory/pages/InventoryCheckList';
import InventoryCheckDetail from '@/features/inventory/pages/InventoryCheckDetail';
import OpeningStockImport from "@/features/inventory/pages/OpeningStockImport";
import ProductMasterDataPage from "@/pages/settings/data/ProductMasterDataPage"; // [NEW]
import QuickUnitPage from "@/pages/quick/QuickUnitPage";
import QuickMinMaxPage from "@/pages/quick/QuickMinMaxPage";
import QuickPricePage from "@/pages/quick/QuickPricePage";
import QuickBarcodePage from "@/pages/quick/QuickBarcodePage";
import ConnectPage from "@/features/connect/pages/ConnectPage"; // [NEW]

//import CustomerSegmentsDetailPage from "@/pages/crm/CustomerSegmentsDetailPage";

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
             path: "connect",
             element: <ConnectPage />,
          },
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
            element: <B2COrderListPage />,
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
            path: "medical/reception", // [NEW]
            element: <ReceptionPage />,
          },
          {
            path: "medical/dashboard",
            element: <PagePlaceholder title="Dashboard Y Tế" />,
          },
          // [NEW] Route Bác sĩ làm việc
          {
            path: "medical/examination",
            element: <DoctorQueuePage />, // Trang danh sách chờ
          },
          {
            path: "medical/examination/:id", // Trang khám chi tiết
            element: <DoctorPage />,
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
          // [NEW] Route Sửa đơn hàng
          {
            path: "b2b/orders/edit/:id", 
            element: <CreateB2BOrderPage />, 
          },
          {
            path: "b2b/orders",
            element: <B2BOrderListPage />,
          },
          {
            path: "b2b/orders/:id",
            element: <B2BOrderDetailPage />,
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
            path: "inventory/outbound",
            element: <WarehouseOutboundPage />,
          },
          {
            path: "inventory/outbound/:id",
            element: <WarehouseOutboundDetailPage />,
          },
          {
            path: "inventory/transfer",
            element: <TransferListPage />,
          },
          {
            path: "inventory/transfer/new",
            element: <TransferCreatePage />,
          },
          { path:"/inventory/transfers/:id",
            element: <TransferDetailPage />
           },

          {
            path: "inventory/stocktake",
            element: <InventoryCheckList />,
          },
          {
            path: "inventory/stocktake/:id",
            element: <InventoryCheckDetail />,
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
              {
                path: "costing/:id",
                element: <PurchaseCostingPage />, // [NEW] V35 Costing
              },
            ],
          },



          // 7. Thao tác Nhanh
          {
            path: "quick/product-location",
            element: (
              <PermissionGuard permission={PERMISSIONS.QUICK.LOCATION_UPDATE}>
                <QuickLocationUpdate />
              </PermissionGuard>
            ),
          },
          {
            path: "quick/unit-setup", // [NEW]
            element: (
              <PermissionGuard permission={PERMISSIONS.QUICK.UNIT_SETUP}>
                <QuickUnitPage />
              </PermissionGuard>
            ),
          },
          {
            path: "quick/min-max", // [NEW]
            element: (
              <PermissionGuard permission={PERMISSIONS.QUICK.MIN_MAX}>
                <QuickMinMaxPage />
              </PermissionGuard>
            ),
          },
          {
            path: "quick/price-edit",
            element: (
              <PermissionGuard permission={PERMISSIONS.QUICK.PRICE_UPDATE}>
                <QuickPricePage />
              </PermissionGuard>
            ),
          },
          {
            path: "quick/barcode-edit",
            element: (
              <PermissionGuard permission={PERMISSIONS.QUICK.BARCODE}>
                <QuickBarcodePage />
              </PermissionGuard>
            ),
          },
          {
            path: "quick/promo-code",
            element: (
                <PermissionGuard permission={PERMISSIONS.QUICK.VOUCHER}>
                    <PagePlaceholder title="Tạo nhanh Mã Giảm Giá" />
                </PermissionGuard>
            )
          },
          {
            path: "quick/prescription-template",
            element: (
                <PermissionGuard permission={PERMISSIONS.QUICK.PRESCRIPTION}>
                    <PrescriptionTemplatePage />
                </PermissionGuard>
            )
          },
          {
            path: "quick/vaccination-template",
            element: (
                <PermissionGuard permission={PERMISSIONS.QUICK.VACCINATION}>
                   <VaccinationTemplatePage />
                </PermissionGuard>
            )
          },

          // 8. Đối tác
          {
            path: "partners",
            element: <Navigate to="/partners/suppliers" replace />,
          },
          { 
              path: "partners/suppliers", 
              element: (
                  <PermissionGuard permission={PERMISSIONS.PARTNER.SUPPLIER.VIEW}>
                      <SupplierListPage /> 
                  </PermissionGuard>
              )
          },
          { 
              path: "partners/new", 
              element: (
                  <PermissionGuard permission={PERMISSIONS.PARTNER.SUPPLIER.CREATE}>
                      <SupplierDetailPage />
                  </PermissionGuard>
              ) 
          },
          { 
              path: "partners/edit/:id", 
              element: (
                  <PermissionGuard permission={PERMISSIONS.PARTNER.SUPPLIER.EDIT}>
                      <SupplierDetailPage /> 
                  </PermissionGuard>
              )
          },
          { 
              path: "partners/detail/:id", 
              element: (
                  <PermissionGuard permission={PERMISSIONS.PARTNER.SUPPLIER.VIEW}>
                      <SupplierDetailPage /> 
                  </PermissionGuard>
              )
          },
          {
            path: "partners/shipping",
            element: (
                  <PermissionGuard permission={PERMISSIONS.PARTNER.SHIPPING.VIEW}>
                      <ShippingPartnerPage />
                  </PermissionGuard>
              ),
          },
          {
            path: "partners/policies",
            element: <SupplierPolicyListPage />,
          },
          {
            path: "partners/policies/new",
            element: <SupplierPolicyFormPage />,
          },
          {
            path: "partners/policies/:id",
            element: <SupplierPolicyFormPage />,
          },

          // 9. Quản lý Khách hàng
          { path: "crm", element: <Navigate to="/crm/retail" replace /> },
          {
            path: "crm/retail",
            element: (
                <PermissionGuard permission={PERMISSIONS.CRM.B2C.VIEW}>
                    <CustomerB2CPage />
                </PermissionGuard>
            ),
          },
          {
            path: "crm/organization/new",
            element: (
                <PermissionGuard permission={PERMISSIONS.CRM.B2C.CREATE}>
                    <CustomerB2COrgForm />
                </PermissionGuard>
            ),
          },
          {
            path: "crm/organization/edit/:id",
            element: (
                <PermissionGuard permission={PERMISSIONS.CRM.B2C.EDIT}>
                    <CustomerB2COrgForm />
                </PermissionGuard>
            ),
          },
          { 
              path: "crm/b2b", 
              element: (
                  <PermissionGuard permission={PERMISSIONS.CRM.B2B.VIEW}>
                      <CustomerB2BPage />
                  </PermissionGuard>
              ) 
          },

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
            element: <CustomerSegmentsPage />,
          },
          
          {
            path: "marketing/tools/distribution", 
            element: <VoucherDistributionPage />,
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
            element: <ReconciliationPage />,
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
          // [PROTECTED] Settings Group
          {
            element: (
              <PermissionGuard permission="settings">
                <Outlet />
              </PermissionGuard>
            ),
            children: [
              {
                path: "settings",
                element: <SystemSettingsHub />,
              },
              // [NEW] Route cho trang Nhập Tồn
              {
                path: "settings/opening-stock",
                element: <OpeningStockImport />,
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
               // [NEW] Quản lý Master Data (Import/Export Excel)
              {
                path: "settings/data/master", 
                element: <ProductMasterDataPage />,
              },
            ]
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
            element: <PosPage />,
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
