// src/pages/inventory/receipt/WarehouseReceiptPage.tsx
import {
  Affix,
  Button,
  Card,
  DatePicker,
  Grid,
  Input,
  InputNumber,
  Row,
  Col,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Result,
  Empty,
  message,
} from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Mic,
  Printer,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { inboundService } from "@/features/inventory/api/inboundService"; // [NEW]
import { PutawayListTemplate } from "@/features/inventory/components/print/PutawayListTemplate";
import { useInboundDetail } from "@/features/inventory/hooks/useInboundDetail";
import { InboundDetailItem } from "@/features/inventory/types/inbound";
import { BarcodeAssignModal } from "@/features/product/components/BarcodeAssignModal"; // [NEW]
import { useRowFlasher } from "@/shared/hooks/useRowFlasher"; // [NEW]
import { safeRpc } from "@/shared/lib/safeRpc";
import { ScannerListener } from "@/shared/ui/warehouse-tools/ScannerListener"; // [NEW]

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const WarehouseReceiptPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  // [NEW] Row Flasher Hook
  const { highlightedKey, flash } = useRowFlasher();

  // FIX ID LOGIC: Handle id, poId, taskId
  const idStr = params.id || params.poId || params.taskId;

  const {
    detail,
    workingItems,
    loading,
    error,
    isSubmitting,
    updateWorkingItem,
    handleSubmit,
    handleSaveDraft,
    handleVoiceCommand,
    handleCameraScan,
    handleDocUpload,
    refetch, // [NEW]
  } = useInboundDetail(idStr);

  const [costLoading, setCostLoading] = useState(false);

  const handleAllocateCosts = async () => {
    if (!idStr) return;
    setCostLoading(true);
    try {
      await inboundService.allocateCosts(parseInt(idStr));
      message.success("Đã phân bổ chi phí và cập nhật giá vốn!");
      refetch();
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi phân bổ: " + err.message);
    } finally {
      setCostLoading(false);
    }
  };

  // [NEW] Integration Logic
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState("");

  const handleScan = async (code: string) => {
    // 1. Kiểm tra Local trước (Ưu tiên sản phẩm đã có trong phiếu)
    // Tìm theo Barcode hoặc SKU
    const existingItem = workingItems.find(
      (i) => i.barcode === code || i.sku === code
    );

    if (existingItem) {
      const inputId = `qty-input-${existingItem.product_id}`;
      const wrapperEl = document.getElementById(inputId);
      const inputEl = wrapperEl?.querySelector('input');

      // [LOGIC MỚI]: Kiểm tra xem ô input này có đang được Focus không?
      const isFocused = document.activeElement === inputEl;

      if (!isFocused) {
        // --- QUÉT LẦN 1: TÌM VỊ TRÍ, BÔI ĐEN, KHÔNG CỘNG SỐ LƯỢNG ---
        message.info(`Đã chọn: ${existingItem.product_name}`);
        flash(existingItem.product_id); 

        setTimeout(() => {
          if (wrapperEl && inputEl) {
            wrapperEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inputEl.focus();
            inputEl.select(); // Bôi đen để sẵn sàng gõ số đè lên
          }
        }, 100);
      } else {
        // --- QUÉT LẦN 2 (Và các lần sau): CỘNG +1 SỐ LƯỢNG ---
        const newQty = (existingItem.input_quantity || 0) + 1;
        updateWorkingItem(existingItem.product_id, { input_quantity: newQty });
        message.success(`+1 ${existingItem.product_name} (Tổng: ${newQty})`);
        flash(existingItem.product_id);
        
        // Giữ bôi đen sau khi cộng để user vẫn có thể gõ đè nếu đổi ý
        setTimeout(() => inputEl?.select(), 50);
      }
      return;
    }

    const hide = message.loading("Tra cứu...", 0);
    try {
      // 2. Lookup via RPC
      const { data } = await safeRpc("search_products_pos", {
        p_keyword: code,
        p_limit: 1,
        p_warehouse_id: 0, // Global search or use proper ID if available
      });

      if (data && data.length > 0) {
        const product = data[0];
        // Check again by ID in case barcode mismatch locally
        const item = workingItems.find((i) => i.product_id === product.id);
        if (item) {
          const inputId = `qty-input-${item.product_id}`;
          const wrapperEl = document.getElementById(inputId);
          const inputEl = wrapperEl?.querySelector('input');

          const isFocused = document.activeElement === inputEl;

          if (!isFocused) {
            // --- QUÉT LẦN 1: TÌM VỊ TRÍ, BÔI ĐEN, KHÔNG CỘNG SỐ LƯỢNG ---
            message.info(`Đã chọn: ${product.name}`);
            flash(item.product_id); 
            setTimeout(() => {
              if (wrapperEl && inputEl) {
                wrapperEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                inputEl.focus();
                inputEl.select(); 
              }
            }, 100);
          } else {
            // --- QUÉT LẦN 2: CỘNG +1 SỐ LƯỢNG ---
            const newQty = (item.input_quantity || 0) + 1;
            updateWorkingItem(item.product_id, { input_quantity: newQty });
            message.success(`+1 ${product.name} (Tổng: ${newQty})`);
            flash(item.product_id);
            setTimeout(() => inputEl?.select(), 50);
          }
        } else {
          message.warning(
            `Sản phẩm "${product.name}" không có trong phiếu nhập này!`
          );
        }
      } else {
        // Not found -> Quick Assign
        setUnknownBarcode(code);
        setAssignModalVisible(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      hide();
    }
  };

  const handleAssignSuccess = (product: any) => {
    setAssignModalVisible(false);
    const item = workingItems.find((i) => i.product_id === product.id);
    if (item) {
      updateWorkingItem(item.product_id, {
        input_quantity: (item.input_quantity || 0) + 1,
      });
      message.success(`Đã gán mã & Nhập thêm: ${product.name}`);
      flash(item.product_id);
      setTimeout(() => {
        const wrapperId = `qty-input-${item.product_id}`;
        const wrapperEl = document.getElementById(wrapperId);
        if (wrapperEl) {
          wrapperEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const inputEl = wrapperEl.querySelector('input');
          if (inputEl) {
            inputEl.focus();
            inputEl.select();
          }
        }
      }, 100);
    } else {
      message.warning(
        `Đã gán mã cho "${product.name}", nhưng sản phẩm này không nằm trong phiếu nhập!`
      );
    }
  };

  // [NEW] Xác định trạng thái "Đã hoàn tất" để khóa giao diện
  const currentStatus = (detail?.po_info?.status || "").toLowerCase();
  const deliveryStatus = (
    (detail?.po_info as any)?.delivery_status || ""
  ).toLowerCase();
  const isDone =
    currentStatus === "completed" ||
    currentStatus === "delivered" ||
    deliveryStatus === "delivered";

  // --- COLUMNS ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 250,
      render: (text: string, record: InboundDetailItem) => (
        <Space>
          <div
            style={{
              width: 48,
              height: 48,
              background: "#f0f0f0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <img
              src={record.image_url || "https://placehold.co/48"}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>
              {text}
              {/* THÊM DÒNG NÀY: */}
              {(record as any).is_bonus ? (
                <Tag color="purple" style={{ marginLeft: 8 }}>
                  🎁 Tặng
                </Tag>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>{record.sku}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      width: 80,
      align: "center" as const,
    },
    // [NEW] Landed Cost Columns
    {
      title: "Phí PB",
      dataIndex: "allocated_cost",
      width: 100,
      align: "right" as const,
      render: (val: number) =>
        val ? <Text type="secondary">{val.toLocaleString()}</Text> : "-",
    },
    {
      title: "Giá Vốn",
      dataIndex: "final_unit_cost",
      width: 110,
      align: "right" as const,
      render: (val: number) =>
        val ? <Text strong>{val.toLocaleString()}</Text> : "-",
    },
    {
      title: "Tiến độ",
      width: 50,
      render: (_: any, record: InboundDetailItem) => {
        const received = record.quantity_received_prev;
        const total = record.quantity_ordered;
        const remaining = record.quantity_remaining;
        const isFull = remaining <= 0;

        return (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span>
                Đã về: <b>{received}</b>/{total}
              </span>
            </div>
            {isFull ? (
              <Tag color="success">Đủ hàng</Tag>
            ) : (
              <Text type="warning" style={{ fontSize: 12 }}>
                Thiếu: {remaining}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Số Lượng Nhập",
      width: 60,
      render: (_: any, record: InboundDetailItem) => {
          // [NEW] Nếu đơn đã khóa, hiển thị số lượng ĐÃ NHẬP. Nếu chưa khóa, hiển thị số lượng ĐANG NHẬP.
          const displayQty = isDone ? record.quantity_received_prev : record.input_quantity;

          return (
              <div id={`qty-input-${record.product_id}`}>
                <InputNumber 
                    min={0}
                    value={displayQty}
                    onChange={(val) => updateWorkingItem(record.product_id, { input_quantity: val || 0 })}
                    style={{ width: "100%" }}
                    disabled={isDone} 
                    placeholder="0"
                    status={(!isDone && (record.input_quantity || 0) > 0) ? "warning" : ""}
                />
              </div>
          );
      }
    },
    // THAY THẾ CỘT SỐ LÔ BẰNG LOGIC RENDER MỚI:
    {
        title: "Số Lô đã nhập",
        width: 150,
        render: (_: any, record: any) => {
            if (record.stock_management_type !== 'lot_date') return <Text disabled>--</Text>;

            const hasReceivedBatches = record.received_batches && record.received_batches.length > 0;

            // 1. Chế độ Xem (Khi đơn đã có lịch sử nhập lô)
            if (hasReceivedBatches) {
                return (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        {record.received_batches.map((batch: any, idx: number) => (
                            <Tag color="geekblue" key={idx} style={{ margin: 0, display: 'block', whiteSpace: 'normal' }}>
                                <b>Lô:</b> {batch.lot_number} <br/>
                                <span style={{ fontSize: 11 }}>
                                  <b>HSD:</b> {batch.expiry_date ? dayjs(batch.expiry_date).format("DD/MM/YY") : "N/A"} - ({batch.quantity} {record.unit})
                                </span>
                            </Tag>
                        ))}
                    </Space>
                );
            }

            // 2. Chế độ Nhập (Khi đang thực hiện nhập kho)
            const displayLot = record.input_lot || "";
            return (
                <Input 
                    placeholder="Nhập số lô"
                    value={displayLot}
                    onChange={(e) => updateWorkingItem(record.product_id, { input_lot: e.target.value })}
                    disabled={isDone} 
                />
            );
        }
    },
    // THAY THẾ CỘT HẠN SỬ DỤNG BẰNG LOGIC MỚI:
    {
        title: "Hạn Sử Dụng",
        width: 180,
        render: (_: any, record: any) => {
             if (record.stock_management_type !== 'lot_date') return <Text disabled>--</Text>;
             
             // Nếu đã có mảng lô thì ẩn ô chọn ngày (vì đã hiển thị gộp ở cột Lô)
             if (record.received_batches && record.received_batches.length > 0) {
                 return <Text type="secondary" italic style={{ fontSize: 12 }}>Đã lưu theo lô</Text>;
             }

             const displayExpiry = record.input_expiry;
             return (
                 <DatePicker 
                    placeholder="VD: 140228"
                    style={{ width: "100%" }}
                    format={["DD/MM/YYYY", "DDMMYY", "DDMMYYYY", "D/M/YY", "D/M/YYYY"]}
                    value={displayExpiry ? dayjs(displayExpiry) : null}
                    onChange={(date) => updateWorkingItem(record.product_id, { input_expiry: date ? date.toISOString() : undefined })}
                    disabled={isDone} 
                 />
             );
        }
    },
  ];

  if (!idStr)
    return (
      <Result
        status="404"
        title="URL không hợp lệ"
        subTitle="Không tìm thấy mã phiếu nhập"
        extra={
          <Button type="primary" onClick={() => navigate("/inventory/inbound")}>
            Quay lại
          </Button>
        }
      />
    );

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
  if (error)
    return (
      <Result
        status="error"
        title="Lỗi"
        subTitle={error}
        extra={
          <Button onClick={() => navigate("/inventory/inbound")}>
            Quay lại
          </Button>
        }
      />
    );
  if (!detail) return <Empty description="Không tìm thấy dữ liệu" />;

  const handlePrintPutaway = () => {
    window.print();
  };

  return (
    <div
      style={{
        padding: screens.md ? 24 : 12,
        paddingBottom: 100,
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      {/* HEADER & TOOLS */}
      <Card
        bodyStyle={{ padding: "16px 24px" }}
        style={{ marginBottom: 16 }}
        bordered={false}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center">
              <Button
                icon={<ArrowLeft size={18} />}
                onClick={() => navigate("/inventory/inbound")}
                type="text"
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {detail.po_info.code} - {detail.po_info.supplier_name}
                </Title>
              </div>
              <Tag color="geekblue">{detail.po_info.status}</Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Đọc lệnh: 'Số lượng 50, Lô A123'">
                <Button
                  icon={<Mic size={16} />}
                  onClick={handleVoiceCommand}
                  shape="circle"
                  size="large"
                />
              </Tooltip>
              <Tooltip title="Quét Camera AI">
                <Button
                  icon={<Camera size={16} />}
                  onClick={handleCameraScan}
                  shape="circle"
                  size="large"
                />
              </Tooltip>
              <Tooltip title="Upload phiếu giao hàng">
                <Button
                  icon={<Upload size={16} />}
                  onClick={() => handleDocUpload(new File([], ""))}
                  shape="circle"
                  size="large"
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* MAIN TABLE */}
      <Card
        bodyStyle={{ padding: 0 }}
        title="Danh sách hàng nhập"
        bordered={false}
      >
        <Table
          columns={columns}
          dataSource={workingItems}
          rowKey="product_id"
          pagination={false}
          scroll={{ x: 1000 }}
          // [NEW] Highlight row animation
          rowClassName={(record) =>
            String(record.product_id) === highlightedKey ? "flash-row" : ""
          }
        />
      </Card>

      {/* FOOTER ACTIONS */}
      <Affix offsetBottom={0}>
        <div
          style={{
            padding: "16px 24px",
            background: "#fff",
            boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          <Button icon={<Printer size={16} />} onClick={handlePrintPutaway}>
            In Phiếu Xếp Kệ
          </Button>

          <Space>
            <Button onClick={() => navigate("/inventory/inbound")}>
              Thoát
            </Button>
            <Button 
              onClick={handleSaveDraft} 
              disabled={isDone}
              style={{ borderColor: '#faad14', color: '#faad14' }}
            >
              Lưu Nháp (F3)
            </Button>
            <Button
              type="primary"
              icon={<CheckCircle size={16} />}
              size="large"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={isDone} // [NEW] Sử dụng biến isDone
            >
              Hoàn tất Nhập Kho
            </Button>
            <Button
              type="default"
              onClick={handleAllocateCosts}
              loading={costLoading}
              disabled={
                detail.po_info.status !== "pending" &&
                detail.po_info.status !== "partial"
              }
            >
              Phân bổ chi phí
            </Button>
          </Space>
        </div>
      </Affix>

      {/* PRINT TEMPLATE */}
      <PutawayListTemplate
        items={workingItems.filter((i) => (i.input_quantity || 0) > 0)}
        poCode={detail.po_info.code}
      />

      {/* [NEW] Tools */}
      <ScannerListener onScan={handleScan} enabled={true} />
      <BarcodeAssignModal
        visible={assignModalVisible}
        scannedBarcode={unknownBarcode}
        onCancel={() => setAssignModalVisible(false)}
        onSuccess={handleAssignSuccess}
      />

      <style>{`
        /* Định nghĩa hiệu ứng chớp tắt */
        @keyframes rowFlash {
          0% { background-color: #b7eb8f !important; }  /* Xanh lá đậm lúc mới quét */
          40% { background-color: #f6ffed !important; } /* Giữ xanh lá nhạt */
          100% { background-color: transparent !important; }
        }

        /* Gắn animation vào class */
        .flash-row {
          animation: rowFlash 1.5s ease-out !important;
        }
        
        /* Bắt buộc phải đè màu nền mặc định của Ant Design Table Cell */
        .flash-row td {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default WarehouseReceiptPage;
