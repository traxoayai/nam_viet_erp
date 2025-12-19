// src/pages/sales/B2BOrderListPage.tsx
import {
  DollarCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

// 1. Import UI Kit (AURA)
import { B2BOrderColumns } from "./components/B2BOrderColumns";

import { useB2BOrders } from "@/features/b2b/hooks/useB2BOrders";
import { FilterAction } from "@/shared/ui/listing/FilterAction";
import { SmartTable } from "@/shared/ui/listing/SmartTable";
import { StatHeader } from "@/shared/ui/listing/StatHeader";
import { B2B_STATUS_LABEL } from "@/shared/utils/b2bConstants";

const B2BOrderListPage = () => {
  const navigate = useNavigate();

  // AURA chỉ việc gọi Hook và lấy data, không quan tâm logic bên trong
  const { tableProps, filterProps, stats, currentFilters } = useB2BOrders();

  // Config StatHeader (Dashboard mini) từ data stats của Nexus
  const statItems = [
    {
      title: "Doanh số tháng",
      value: `${stats.sales_this_month.toLocaleString()} ₫`,
      color: "#1890ff",
      icon: <DollarCircleOutlined />,
    },
    {
      title: "Đơn chờ duyệt",
      value: stats.draft_count,
      color: "#faad14",
      icon: <FileTextOutlined />,
    },
    {
      title: "Chưa thanh toán",
      value: stats.pending_payment,
      color: "#ff4d4f",
      icon: <WarningOutlined />,
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
    <div style={{ padding: 8, background: "#f0f2f5", minHeight: "100vh" }}>
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
