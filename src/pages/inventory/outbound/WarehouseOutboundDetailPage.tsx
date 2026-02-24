import {
  Affix,
  Button,
  Card,
  Grid,
  InputNumber,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Spin,
  Modal,
  Input,
} from "antd";
import dayjs from "dayjs";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  Printer,
  Save,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { outboundService } from "@/features/inventory/api/outboundService";
import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate";
import { ShippingLabelTemplate } from "@/features/inventory/components/print/ShippingLabelTemplate";
import {
  OutboundOrderInfo,
  OutboundPickItem,
} from "@/features/inventory/types/outbound";
import { useRowFlasher } from "@/shared/hooks/useRowFlasher";
import { ScannerListener } from "@/shared/ui/warehouse-tools/ScannerListener";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const WarehouseOutboundDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  // Custom Hook
  const { highlightedKey, flash } = useRowFlasher();

  // State
  const [orderInfo, setOrderInfo] = useState<OutboundOrderInfo | null>(null);
  const [items, setItems] = useState<OutboundPickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Print State
  const [printMode, setPrintMode] = useState<"picking" | "label" | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  const fetchDetail = async (orderId: string) => {
    setLoading(true);
    try {
      const data = await outboundService.getOrderDetail(orderId);
      setOrderInfo(data.order_info);
      setItems(
        data.items.map((item) => ({
          ...item,
          quantity_picked: item.quantity_picked || 0,
        }))
      );
    } catch (error) {
      message.error("Lỗi tải chi tiết đơn hàng");
      navigate("/inventory/outbound");
    } finally {
      setLoading(false);
    }
  };

  // --- PRINT HANDLERS ---
  const handlePrintPicking = () => {
    setPrintMode("picking");
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 200);
  };

  const handlePrintLabel = () => {
    setPrintMode("label");
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 200);
  };

  // --- ACTIONS ---
  const handleScan = (code: string) => {
    const targetIndex = items.findIndex(
      (i) => i.barcode === code || i.sku === code
    );

    if (targetIndex === -1) {
      message.error("Sản phẩm không có trong đơn!");
      return;
    }

    const item = items[targetIndex];
    if (item.quantity_picked >= item.quantity_ordered) {
      message.warning(`Đã nhặt đủ ${item.product_name}!`);
      flash(item.product_id); // Flash Row
      return;
    }

    // Increment
    const newItems = [...items];
    newItems[targetIndex].quantity_picked += 1;
    setItems(newItems);
    message.success(`Đã nhặt: ${item.product_name}`);

    // UI Feedback
    flash(item.product_id); // Flash Row
  };

  const handleManualChange = (idx: number, val: number | null) => {
    const newItems = [...items];
    newItems[idx].quantity_picked = val || 0;
    setItems(newItems);
  };

  // 1. SAVE DRAFT
  const handleSaveDraft = async () => {
    if (!id) return;
    try {
      const payload = items.map((i) => ({
        product_id: i.product_id,
        quantity_picked: i.quantity_picked,
      }));
      await outboundService.saveProgress(id, payload);
      message.success("Đã lưu nháp tiến độ!");
    } catch (error) {
      message.error("Lỗi lưu nháp");
    }
  };

  // 2. CANCEL
  const handleCancelClick = () => {
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!id || !cancelReason) return;
    try {
      await outboundService.cancelTask(id, cancelReason);
      message.success("Đã hủy đơn hàng!");
      navigate("/inventory/outbound");
    } catch (error) {
      message.error("Lỗi hủy đơn hàng");
    }
  };

  // 3. COMPLETE PICKING & PACKING
  const handleCompletePacking = async () => {
    if (!id) return;

    const missing = items.filter((i) => i.quantity_picked < i.quantity_ordered);
    if (missing.length > 0) {
      Modal.confirm({
        title: "Cảnh báo thiếu hàng",
        content: `Còn ${missing.length} sản phẩm chưa nhặt đủ. Bạn có chắc chắn muốn hoàn thành?`,
        okText: "Vẫn hoàn thành",
        okButtonProps: { danger: true },
        onOk: executePacking,
      });
    } else {
      executePacking();
    }
  };

  const executePacking = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await outboundService.confirmPacking(id);
      message.success("Thành công: Đã trừ kho & Đóng gói!");
      // Refetch to see new status (PACKED)
      await fetchDetail(id);
    } catch (error: any) {
      // Basic error handling for inventory issues
      if (error?.message?.includes("Kho không đủ hàng")) {
        message.error("Lỗi: Kho không đủ hàng để đóng gói!");
      } else {
        message.error("Lỗi xác nhận đóng gói");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 4. HANDOVER SHIPPING
  const handleHandover = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await outboundService.handoverShipping(id);
      message.success("Thành công: Đơn hàng đã bàn giao vận chuyển!");
      // Refetch to see new status (SHIPPING)
      await fetchDetail(id);
    } catch (error) {
      message.error("Lỗi giao vận chuyển");
    } finally {
      setSubmitting(false);
    }
  };

  // --- COLUMNS ---
  const columns = [
    {
      title: "#",
      render: (_: any, __: any, idx: number) => idx + 1,
      width: 50,
    },
    {
      title: "Vị trí",
      dataIndex: "shelf_location",
      width: 150,
      render: (val: string) =>
        val ? (
          <Tag color="geekblue" icon={<MapPin size={12} />}>
            {val}
          </Tag>
        ) : (
          <Text type="secondary">N/A</Text>
        ),
    },
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      render: (val: string, record: OutboundPickItem) => (
        <Space>
          <div
            style={{
              width: 40,
              height: 40,
              background: "#f0f0f0",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {record.image_url ? (
              <img
                src={record.image_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Package size={20} color="#ccc" />
            )}
          </div>
          <div>
            <Text strong>{val}</Text>
            <br />
            <Text type="secondary" copyable>
              {record.sku}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Gợi ý lấy hàng (FEFO)",
      dataIndex: "fefo_suggestion",
      width: 350,
      render: (fefo: any) =>
        fefo ? (
          <div style={{ fontSize: 13 }}>
            <div>
              Lô: <b>{fefo.batch_code}</b>
            </div>
            <div
              style={{
                color:
                  dayjs(fefo.expiry_date).diff(dayjs(), "day") < 30
                    ? "#faad14"
                    : "inherit",
              }}
            >
              HSD: {dayjs(fefo.expiry_date).format("DD/MM/YYYY")}
            </div>
          </div>
        ) : (
          <Text type="secondary" italic>
            Không có gợi ý
          </Text>
        ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 80,
    },
    {
      title: "Yêu cầu",
      dataIndex: "quantity_ordered",
      width: 100,
      align: "center" as const,
      render: (val: number) => (
        <Text strong style={{ fontSize: 16 }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Đã nhặt",
      dataIndex: "quantity_picked",
      width: 120,
      render: (val: number, record: OutboundPickItem, idx: number) => (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleManualChange(idx, v)}
          status={val > record.quantity_ordered ? "error" : ""}
          style={{ width: "100%" }}
          disabled={orderInfo?.status !== "CONFIRMED"} // Disable editing if already packed
        />
      ),
    },
    {
      title: "Trạng thái",
      width: 100,
      render: (_: any, record: OutboundPickItem) => {
        if (record.quantity_picked === record.quantity_ordered)
          return <Tag color="success">Đủ</Tag>;
        if (record.quantity_picked > record.quantity_ordered)
          return <Tag color="error">Thừa</Tag>;
        return <Tag color="warning">Thiếu</Tag>;
      },
    },
  ];

  if (loading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  if (!orderInfo) return null;

  const isConfirmed = orderInfo.status === "CONFIRMED";
  const isPacked = orderInfo.status === "PACKED";
  const isShipping = ["SHIPPING", "DELIVERED"].includes(orderInfo.status);

  return (
    <div
      style={{
        padding: screens.md ? 8 : 12,
        paddingBottom: 100,
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <ScannerListener onScan={handleScan} enabled={isConfirmed} />

      {/* Conditional Print Templates */}
      {printMode === "picking" && (
        <PickingListTemplate orderInfo={orderInfo} items={items} />
      )}
      {printMode === "label" && (
        <ShippingLabelTemplate orderInfo={orderInfo} packageCount={1} />
      )}

      {/* HEADER */}
      <Card bodyStyle={{ padding: "12px 24px" }} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Space>
            <Button
              icon={<ArrowLeft size={18} />}
              onClick={() => navigate("/inventory/outbound")}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {orderInfo.code}
              </Title>
              <Text type="secondary">{orderInfo.customer_name}</Text>
            </div>
          </Space>
          <Space direction="vertical" align="end" size={4}>
            <Tag color="blue" style={{ fontSize: 14, padding: "4px 8px" }}>
              {orderInfo.status}
            </Tag>
            <Space>
              {orderInfo.shipping_partner ? (
                <Tag icon={<Truck size={12} />} color="geekblue">
                  {orderInfo.shipping_partner}
                </Tag>
              ) : null}
              {orderInfo.cutoff_time ? (
                <Tag icon={<Clock size={12} />} color="volcano">
                  {dayjs(orderInfo.cutoff_time).format("HH:mm DD/MM")}
                </Tag>
              ) : null}
            </Space>
          </Space>
        </div>
      </Card>

      {/* CONTENT */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="product_id"
          pagination={false}
          rowClassName={(record) =>
            String(record.product_id) === highlightedKey ? "flash-row" : ""
          }
          scroll={{ x: 800 }}
        />
      </Card>

      {/* FOOTER ACTION BAR */}
      <Affix offsetBottom={0}>
        <div
          style={{
            padding: "12px 24px",
            background: "#fff",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
            display: "flex",
            justifyContent: "space-between",
            zIndex: 999,
          }}
        >
          <Space>
            {/* Hủy allowed in CONFIRMED and PACKED */}
            {isConfirmed || isPacked ? (
              <Button danger onClick={handleCancelClick}>
                Hủy
              </Button>
            ) : null}
            <Button icon={<Printer size={16} />} onClick={handlePrintPicking}>
              In phiếu nhặt
            </Button>
            <Button icon={<Package size={16} />} onClick={handlePrintLabel}>
              In Vận Đơn
            </Button>
          </Space>

          <Space>
            {isConfirmed ? (
              <>
                <Button icon={<Save size={16} />} onClick={handleSaveDraft}>
                  Lưu nháp
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircle size={16} />}
                  onClick={handleCompletePacking}
                  loading={submitting}
                >
                  Đóng Gói (Trừ Kho)
                </Button>
              </>
            ) : null}

            {isPacked ? (
              <Button
                type="primary"
                icon={<Truck size={16} />}
                onClick={handleHandover}
                loading={submitting}
              >
                Giao Vận Chuyển
              </Button>
            ) : null}

            {isShipping ? (
              <Tag color="blue" style={{ fontSize: 15, padding: 8 }}>
                <CheckCircle size={14} style={{ marginRight: 5 }} />
                Đơn hàng đã bàn giao vận chuyển
              </Tag>
            ) : null}
          </Space>
        </div>
      </Affix>

      {/* CANCEL MODAL */}
      <Modal
        title="Hủy Nhiệm vụ / Đơn hàng"
        open={isCancelModalOpen}
        onOk={handleConfirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
        okText="Xác nhận Hủy"
        okButtonProps={{ danger: true }}
        cancelText="Bỏ qua"
      >
        <Text>Vui lòng nhập lý do hủy:</Text>
        <Input.TextArea
          rows={3}
          style={{ marginTop: 8 }}
          placeholder="Nhập lý do..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default WarehouseOutboundDetailPage;
