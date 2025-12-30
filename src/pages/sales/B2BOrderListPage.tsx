// src/pages/sales/B2BOrderListPage.tsx
import {
  DollarCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

// 1. Import UI Kit (AURA)
// 1. Import UI Kit (AURA)
import { B2BOrderColumns } from "./components/B2BOrderColumns";

// import { useB2BOrders } from "@/features/b2b/hooks/useB2BOrders";
import { useSalesOrders } from "@/features/sales/hooks/useSalesOrders";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { B2B_STATUS_LABEL } from "@/shared/utils/b2bConstants";

const B2BOrderListPage = () => {
  const navigate = useNavigate();

  // AURA chỉ việc gọi Hook và lấy data, không quan tâm logic bên trong
  const { tableProps, filterProps, stats, currentFilters } = useSalesOrders({ orderType: 'B2B' });

  // Config StatHeader (Dashboard mini) từ data stats của Nexus
  // Note: New stats structure is { total_sales, count_pending_remittance, total_cash_pending } from get_sales_orders_view
  // But B2B page previously expected { sales_this_month, draft_count, pending_payment }
  // The new RPC `get_sales_orders_view` stats are different.
  // I should adapt statItems to reflect available stats or map them if possible.
  // The RPC returns: 'total_sales' (sales_this_month approx), 'count_pending_remittance', 'total_cash_pending'.
  // It does NOT return 'draft_count' or 'pending_payment' (unpaid orders) in the specific `stats` jsonb from RPC as described in Step 1249.
  // RPC logic:
  // 'total_sales': SUM(final_amount) FILTER (WHERE status NOT IN ('DRAFT', 'CANCELLED'))
  // 'count_pending_remittance': ...
  // 'total_cash_pending': ...
  
  // So 'draft_count' and 'pending_payment' are MISSING from the new RPC stats object.
  // I will map 'total_sales' to 'Doanh số', and maybe hide others or placeholders?
  // User instruction: "Các logic hiển thị khác giữ nguyên hoặc tinh chỉnh cột cho phù hợp".
  // I will adjust stats to show available info.
  
  const statItems = [
    {
      title: "Doanh số (Đã chốt)",
      value: `${(stats?.total_sales || 0).toLocaleString()} ₫`,
      color: "#1890ff",
      icon: <DollarCircleOutlined />,
    },
    {
      title: "Tiền mặt chờ nộp",
      value: `${(stats?.total_cash_pending || 0).toLocaleString()} ₫`,
      color: "#faad14",
      icon: <WarningOutlined />,
    },
     {
      title: "Số đơn chờ nộp",
      value: stats?.count_pending_remittance || 0,
      color: "#ff4d4f",
      icon: <FileTextOutlined />,
    },
  ];

  // Config Filter Options từ Utils của Nexus
  const statusOptions = Object.entries(B2B_STATUS_LABEL).map(
    ([val, label]) => ({
      label,
      value: val,
    })
  );

  return (
    <div style={{ padding: 8, background: "#e1e1dfff", minHeight: "100vh" }}>
      {/* 1. Header Chỉ số */}
      <StatHeader items={statItems} loading={tableProps.loading} />

      {/* 2. Thanh công cụ & Bộ lọc */}
      <FilterAction
        {...filterProps} // Spread props: onSearch, onRefresh...
        searchPlaceholder="Tìm mã đơn, tên khách..."
        filterValues={currentFilters}
        filters={[
          {
            key: "status",
            placeholder: "Lọc trạng thái",
            options: statusOptions,
          },
        ]}
        actions={[
          {
            label: "Tạo đơn mới",
            type: "primary",
            icon: <PlusOutlined />,
            onClick: () => navigate("/b2b/create-order"),
          },
        ]}
      />

      {/* 3. Bảng dữ liệu */}
      <SmartTable
        {...tableProps} // Spread props: dataSource, loading, pagination...
        columns={B2BOrderColumns}
        emptyText="Chưa có đơn hàng nào"
        onRow={(record) => ({
          onClick: () => navigate(`/b2b/orders/${record.id}`), // Click xem chi tiết
          style: { cursor: "pointer" },
        })}
      />
    </div>
  );
};

export default B2BOrderListPage;
