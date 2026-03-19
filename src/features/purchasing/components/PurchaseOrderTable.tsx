// src/features/purchasing/components/PurchaseOrderTable.tsx
import { EyeOutlined, DeleteOutlined, CopyOutlined } from "@ant-design/icons";
import { Table, Tag, Space, Button, Tooltip, Progress, Popconfirm } from "antd";
import dayjs from "dayjs";
import React from "react";
import { Link } from "react-router-dom";

import { PurchaseOrderMaster } from "../types/purchase";

import { formatCurrency } from "@/shared/utils/format";
import { PO_STATUS_CONFIG } from "@/shared/utils/purchaseConstants";

interface PurchaseOrderTableProps {
  orders: PurchaseOrderMaster[];
  loading: boolean;
  pagination: any;
  setPagination: (val: any) => void;
  onDelete?: (id: number) => void;
  onOpenPaymentModal: (order: PurchaseOrderMaster) => void;
  onClone?: (order: PurchaseOrderMaster) => void; // [NEW] Prop Clone
}

// [UPDATED] Helper lấy tên Logistics
const getLogisticsInfo = (r: PurchaseOrderMaster) => {
  // Ưu tiên 1: Tên NCC Vận chuyển (Nếu chọn shipping_partner_id)
  // Giả sử rpc trả về shipping_partner_name, nếu chưa có thì dùng carrier_name
  // Note: r type definition might need update, casting for now if needed or relying on dynamic
  const anyR = r as any;
  const name =
    anyR.shipping_partner_name || anyR.carrier_name || "Chưa chọn ĐVVC";
  const contact = anyR.carrier_phone || anyR.carrier_contact || "";
  return { name, contact };
};

export const PurchaseOrderTable: React.FC<PurchaseOrderTableProps> = ({
  orders,
  loading,
  pagination,
  setPagination,
  onDelete,
  onOpenPaymentModal,
  onClone,
}) => {
  const columns = [
    {
      title: "Mã Đơn",
      dataIndex: "code",
      key: "code",
      fixed: "left" as const,
      width: 120,
      render: (text: string) => (
        <Link to={`/purchase-orders/${text}`} style={{ fontWeight: 600 }}>
          {text}
        </Link>
      ),
    },
    {
      title: "Ngày Tạo/Mua",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (date: string) => (
        <div style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 500 }}>
            {dayjs(date).format("DD/MM/YYYY")}
          </div>
          <div style={{ color: "#888" }}>{dayjs(date).format("HH:mm")}</div>
        </div>
      ),
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "supplier_name",
      key: "supplier_name",
      width: 200,
      render: (text: string) => (
        <div
          style={{
            whiteSpace: "normal",
            wordWrap: "break-word",
          }}
        >
          {text}
        </div>
      ),
    },
    // [UPDATED] Cột Vận chuyển
    {
      title: "Vận chuyển",
      key: "logistics",
      width: 200,
      render: (_: unknown, r: PurchaseOrderMaster) => {
        const { name, contact } = getLogisticsInfo(r);
        return (
          <Space direction="vertical" size={0}>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {contact ? <>{contact} • </> : null}
              📦 {(r as any).total_packages || 1} kiện
            </div>
            {/* Hiển thị Ngày/Giờ dự kiến nếu có */}
            <div
              style={{
                fontSize: 11,
                color: r.expected_delivery_date ? "#1890ff" : "#999",
              }}
            >
              🕒{" "}
              {r.expected_delivery_date
                ? dayjs(r.expected_delivery_date).format("DD/MM HH:mm")
                : "Chưa có lịch"}
            </div>
          </Space>
        );
      },
    },
    // [NEW] Cột Trạng thái Nhập kho (Tách riêng)
    {
      title: "Nhập kho",
      dataIndex: "delivery_status",
      width: 130,
      render: (status: string) => {
        const map: any = {
          draft: { color: "default", text: "Chờ" },
          pending: { color: "orange", text: "Chờ nhập" },
          partial: { color: "blue", text: "Nhập 1 phần" },
          delivered: { color: "green", text: "Đã nhập kho" },
          cancelled: { color: "red", text: "Hủy" },
        };
        // Xử lý case-insensitive
        const s = map[status?.toLowerCase()] || {
          color: "default",
          text: status,
        };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    // [UPDATED] Trạng thái Đơn hàng (Dùng Config mới)
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const config = PO_STATUS_CONFIG[status] ||
          PO_STATUS_CONFIG[status?.toLowerCase()] || {
            color: "default",
            label: status,
          };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Tổng Tiền",
      dataIndex: "final_amount",
      key: "final_amount",
      align: "right" as const,
      width: 140,
      render: (val: number) => (
        <span style={{ fontWeight: 600 }}>{formatCurrency(val)}</span>
      ),
    },
    // [UPDATED] Cột Thanh toán (Fix NaN)
    {
      title: "Thanh toán",
      key: "payment",
      width: 150,
      render: (_: unknown, r: PurchaseOrderMaster) => {
        const total = Number(r.final_amount) || 0; // Ép kiểu an toàn
        const paid = Number(r.total_paid) || 0;
        const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
        const isPaid =
          percent >= 100 || r.payment_status?.toLowerCase() === "paid";

        return (
          <div style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 2,
              }}
            >
              <Tag
                color={isPaid ? "success" : "warning"}
                style={{ marginRight: 0 }}
              >
                {isPaid ? "Đã thanh toán" : "Chưa thanh toán đủ"}
              </Tag>
            </div>
            <Progress
              percent={percent}
              showInfo={false}
              strokeColor={isPaid ? "#52c41a" : "#faad14"}
              size="small"
            />
            <div
              style={{
                fontSize: 11,
                color: "#666",
                marginTop: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Đã trả: {new Intl.NumberFormat("vi-VN").format(paid)}đ
              </span>
              {!isPaid && (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  onClick={() => onOpenPaymentModal(r)}
                >
                  Tạo Thanh Toán
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      fixed: "right" as const,
      width: 120, // Tăng width để chứa nút Copy
      render: (_: unknown, record: PurchaseOrderMaster) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Link to={`/purchase-orders/${record.id}`}>
              <Button size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>

          {/* [NEW] Nút Sao chép */}
          {onClone ? (
            <Tooltip title="Sao chép đơn này">
              <Button
                size="small"
                icon={<CopyOutlined />}
                style={{ color: "#1890ff", borderColor: "#1890ff" }}
                onClick={() => onClone(record)}
              />
            </Tooltip>
          ) : null}

          {onDelete ? (
            <Popconfirm
              title="Bạn có chắc muốn xóa đơn này không?"
              onConfirm={() => onDelete(record.id)}
              okText="Có"
              cancelText="Không"
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const handleTableChange = (newPagination: any) => {
    setPagination({
      page: newPagination.current,
      pageSize: newPagination.pageSize,
      total: pagination.total,
    });
  };

  return (
    <Table
      columns={columns}
      dataSource={orders}
      rowKey="id"
      loading={loading}
      pagination={{
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        showTotal: (total: number) => `Tổng ${total} đơn`,
      }}
      onChange={handleTableChange}
      scroll={{ x: 1200 }}
      size="middle"
    />
  );
};
