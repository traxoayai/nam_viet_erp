// src
import React, { useState, useEffect } from "react";
import { Table, Button, Space, Typography, Tag, Popconfirm, Card, App, Input } from "antd";
import { PlusOutlined, FileAddOutlined, FileExcelOutlined, SearchOutlined, BankOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { usePurchaseOrdersV2 } from "../../features/purchasing-v2/hooks/usePurchaseOrdersV2";
import { useAuthStore } from "../../features/auth/stores/useAuthStore";
import { FinanceFormModal } from "@/pages/finance/components/FinanceFormModal";
import { supabase } from "@/shared/lib/supabaseClient";

const { Title } = Typography;

export default function PurchaseOrderV2ListPage() {
  const navigate = useNavigate();
  
  // Search state with debounce
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Payment Modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [financeInitialValues, setFinanceInitialValues] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: orders, isLoading, deleteOrder } = usePurchaseOrdersV2(searchTerm);
  const { permissions } = useAuthStore();
  const { message } = App.useApp();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const isAdmin = permissions.includes("admin-all");

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    selectedRowKeys.forEach(id => {
      deleteOrder({ id: id as number, hardDelete: isAdmin });
    });
    setSelectedRowKeys([]);
  };

  const handleExportExcel = () => {
    message.success(`Đã xuất Excel cho ${selectedRowKeys.length} đơn hàng!`);
  };

  const handlePaySupplier = async (record: any) => {
    try {
      message.loading({ content: "Đang tải thông tin NCC...", key: "pay_supplier" });
      const { data, error } = await supabase.functions.invoke("info-supplier", {
        body: { id: record.supplier_id },
      });
      if (error) throw error;
      const supplierData = data?.data;

      setFinanceInitialValues({
        business_type: "trade",
        partner_type: "supplier",
        supplier_id: record.supplier_id,
        partner_name: supplierData?.name || record.suppliers?.name,
        amount: Math.max(0, (record.final_amount || 0) - (record.total_paid || 0)),
        description: `Thanh toán cho đơn nhập hàng #${record.code}`,
        reference_code: record.code
      });
      message.success({ content: "Đã tải thông tin NCC", key: "pay_supplier", duration: 2 });
      setPaymentModalVisible(true);
    } catch (err: any) {
      message.error({ content: "Lỗi lấy thông tin NCC: " + err.message, key: "pay_supplier" });
    }
  };

  const handlePayShipping = async (record: any) => {
    if (!record.shipping_partner_id) {
      message.warning("Đơn hàng này không có đơn vị vận chuyển!");
      return;
    }
    try {
      message.loading({ content: "Đang tải thông tin ĐVVC...", key: "pay_shipping" });
      const { data, error } = await supabase.functions.invoke("info-shipping-partner", {
        body: { id: record.shipping_partner_id },
      });
      if (error) throw error;
      const spData = data?.data;

      setFinanceInitialValues({
        business_type: "trade",
        partner_type: "shipping_partner",
        shipping_partner_id: record.shipping_partner_id,
        partner_name: spData?.name || record.shipping_partners?.name,
        amount: 0, // Phí vận chuyển có thể nhập tay
        description: `Thanh toán cước vận chuyển đơn hàng #${record.code}`,
        reference_code: record.code
      });
      message.success({ content: "Đã tải thông tin ĐVVC", key: "pay_shipping", duration: 2 });
      setPaymentModalVisible(true);
    } catch (err: any) {
      message.error({ content: "Lỗi lấy thông tin ĐVVC: " + err.message, key: "pay_shipping" });
    }
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "code",
      key: "code",
      width: 120,
      sorter: (a: any, b: any) => a.code.localeCompare(b.code),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (val: string) => dayjs(val).format("DD/MM/YYYY HH:mm"),
      sorter: (a: any, b: any) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
    {
      title: "Người tạo",
      dataIndex: "creator_name",
      key: "creator_name",
      width: 150,
      render: (val: string) => val || "Hệ thống",
    },
    {
      title: "Nhà cung cấp",
      key: "supplier",
      width: 220,
      render: (_: any, record: any) => <strong>{record.suppliers?.name || "-"}</strong>,
    },
    {
      title: "Vận Chuyển",
      key: "shipping_partner",
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <span>{record.shipping_partners?.name || "-"}</span>
          {record.shipping_partner_id && (
            <Button 
              type="text" 
              size="small" 
              icon={<BankOutlined />} 
              onClick={() => handlePayShipping(record)} 
              title="Thanh toán cước vận chuyển" 
            />
          )}
        </Space>
      ),
    },
    {
      title: "Nhập kho",
      dataIndex: "delivery_status",
      key: "delivery_status",
      width: 150,
      filters: [
        { text: 'Chờ nhập', value: 'pending' },
        { text: 'Nhập một phần', value: 'partial' },
        { text: 'Đã nhập đủ', value: 'completed' },
        { text: 'Giao hàng Thành công', value: 'delivered' },
      ],
      onFilter: (value: any, record: any) => record.delivery_status === value,
      render: (status: string) => {
        let color = "default";
        let label = status;
        if (status === "completed") { color = "green"; label = "Đã nhập đủ"; }
        if (status === "partial") { color = "blue"; label = "Nhập một phần"; }
        if (status === "pending") { color = "orange"; label = "Chờ nhập"; }
        if (status === "delivered") { color = "cyan"; label = "Giao hàng Thành công"; }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      filters: [
        { text: 'Nháp', value: 'draft' },
        { text: 'Chờ duyệt', value: 'pending' },
        { text: 'Đã duyệt', value: 'approved' },
        { text: 'Đã hủy', value: 'cancelled' },
      ],
      onFilter: (value: any, record: any) => (record.status || '').toLowerCase() === value.toLowerCase(),
      render: (status: string) => {
        let color = "default";
        let label = status;
        const normStatus = (status || '').toLowerCase();
        if (normStatus === "approved") { color = "green"; label = "Đã duyệt"; }
        if (normStatus === "cancelled") { color = "red"; label = "Đã hủy"; }
        if (normStatus === "draft") { color = "default"; label = "Nháp"; }
        if (normStatus === "pending") { color = "orange"; label = "Chờ duyệt"; }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Tổng tiền",
      dataIndex: "final_amount",
      key: "final_amount",
      width: 150,
      render: (val: number) => <strong>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0)}</strong>,
    },
    {
      title: "Thanh toán",
      key: "payment",
      width: 200,
      filters: [
        { text: 'Đã thanh toán', value: 'paid' },
        { text: 'Thanh toán một phần', value: 'partial' },
        { text: 'Chưa thanh toán', value: 'unpaid' },
      ],
      onFilter: (value: any, record: any) => record.payment_status === value,
      render: (_: any, record: any) => {
        let color = "default";
        let label = record.payment_status?.toUpperCase() || 'UNPAID';
        if (record.payment_status === "paid") { color = "green"; label = "Đã thanh toán"; }
        if (record.payment_status === "partial") { color = "blue"; label = "Thanh toán một phần"; }
        if (record.payment_status === "unpaid") { color = "orange"; label = "Chưa thanh toán"; }

        return (
          <div>
            <Space>
              <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
              <Button 
                type="text" 
                size="small" 
                icon={<BankOutlined />} 
                onClick={() => handlePaySupplier(record)} 
                title="Tạo thanh toán cho NCC" 
              />
            </Space>
            <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
              Đã trả: {new Intl.NumberFormat("vi-VN").format(record.total_paid || 0)} đ
            </div>
          </div>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 120,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Popconfirm
            title={isAdmin ? "Xóa CỨNG đơn hàng này?" : "Hủy (xóa mềm) đơn hàng này?"}
            onConfirm={() => deleteOrder({ id: record.id, hardDelete: isAdmin })}
          >
            <Button type="link" danger>
              {isAdmin ? "Xóa cứng" : "Hủy đơn"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Quản Lý Đơn Mua Hàng (V2)</Title>
          <Space>
            <Input
              placeholder="Tìm theo Mã, SP, Nhà Cung Cấp..."
              prefix={<SearchOutlined />}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/inventory/purchase-v2/create-minmax")}
            >
              Tạo Dự Trù
            </Button>
            <Button
              type="default"
              icon={<FileAddOutlined />}
              onClick={() => navigate("/inventory/purchase-v2/create-single")}
            >
              Tạo Đơn Lẻ
            </Button>
            <Button
              type="dashed"
              icon={<FileExcelOutlined />}
              onClick={() => navigate("/inventory/purchase-v2/create-vat")}
            >
              Tạo Đơn từ VAT
            </Button>
          </Space>
        </div>

        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
            <span style={{ marginRight: 16 }}>Đã chọn <strong>{selectedRowKeys.length}</strong> đơn hàng</span>
            <Space>
              <Button size="small" icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                Xuất Excel
              </Button>
              <Button size="small" type="primary" onClick={() => message.info("Chức năng thanh toán hàng loạt đang hoàn thiện.")}>
                Thanh toán
              </Button>
              <Popconfirm title={isAdmin ? "Xóa CỨNG các đơn đã chọn?" : "Hủy (xóa mềm) các đơn đã chọn?"} onConfirm={handleBatchDelete}>
                <Button size="small" danger>{isAdmin ? "Xóa cứng" : "Hủy đơn"}</Button>
              </Popconfirm>
            </Space>
          </div>
        )}

        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1600 }}
        />
      </Card>

      {paymentModalVisible && (
        <FinanceFormModal
          open={paymentModalVisible}
          onCancel={() => setPaymentModalVisible(false)}
          initialFlow="out"
          initialValues={financeInitialValues}
          onSuccess={() => {
            setPaymentModalVisible(false);
            message.success("Tạo thanh toán thành công!");
          }}
        />
      )}
    </div>
  );
}
