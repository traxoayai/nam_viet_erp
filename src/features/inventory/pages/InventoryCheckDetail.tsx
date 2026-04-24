// src/features/inventory/pages/InventoryCheckDetail.tsx
import {
  ArrowLeftOutlined,
  SaveOutlined,
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  MinusOutlined,
  PictureOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Button,
  Typography,
  InputNumber,
  //Row,
  //Col,
  Tag,
  Space,
  message,
  Modal,
  Avatar,
  Grid,
  Input,
} from "antd";
import { useEffect, useRef, useState, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { inventoryService } from "../api/inventoryService";
import { useInventoryCheckStore } from "../stores/useInventoryCheckStore";
import { InventoryCheckItem } from "../types/inventory.types";

import { useAuth } from "@/app/contexts/AuthProvider";
import { DebounceSelect } from "@/shared/ui/common/DebounceSelect";
import { parseVoiceCommand } from "@/shared/utils/voiceUtils";

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

export const InventoryCheckDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const screens = useBreakpoint(); // [NEW] Hook check màn hình

  const {
    items,
    activeSession,
    fetchSessionDetails,
    updateItemQuantity,
    confirmItemMatching,
    activeItemId,
    setActiveItem,
    moveToNextItem,
    completeSession,
    saveCheckInfo,
    cancelSession,
    addItemToCheck, // [NEW] Lấy action mới
    removeItem,
  } = useInventoryCheckStore();

  // Ref để quản lý Auto-Scroll
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Voice Simulation State - Now controlled by SpeechRecognition
  // const [isListening, setIsListening] = useState(false); // Removed manual state

  // 1. Load dữ liệu khi vào trang
  useEffect(() => {
    if (id) fetchSessionDetails(Number(id));
    // fetchSessionDetails là stable Zustand action, không cần thêm deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 2. Logic Auto-Scroll: Khi activeItemId đổi -> Cuộn tới đó
  useEffect(() => {
    if (activeItemId && itemRefs.current[activeItemId]) {
      itemRefs.current[activeItemId]?.scrollIntoView({
        behavior: "smooth",
        block: "center", // Căn thẻ vào giữa màn hình điện thoại
      });
    }
  }, [activeItemId]);

  // --- VOICE LOGIC START ---
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // Thêm useEffect để debug trạng thái Mic khi vào trang
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      console.error("Trình duyệt không hỗ trợ Speech Recognition");
      message.error("Thiết bị này không hỗ trợ nhận diện giọng nói!");
    }
    if (!isMicrophoneAvailable) {
      console.warn("Chưa tìm thấy Microphone hoặc chưa cấp quyền.");
    }
  }, [browserSupportsSpeechRecognition, isMicrophoneAvailable]);

  // Tự động bật Mic khi vào chế độ nghe
  const toggleListening = () => {
    if (listening) {
      console.log("User: Stop Listening");
      SpeechRecognition.stopListening();
    } else {
      console.log("User: Start Listening");
      resetTranscript();
      SpeechRecognition.startListening({
        language: "vi-VN",
        continuous: true,
      }).catch((err) => {
        console.error("Lỗi khởi động Mic:", err);
        message.error("Không thể bật Mic. Vui lòng kiểm tra quyền truy cập.");
      });

      message.info("Đang nghe... (Nói số lượng)");
    }
  };

  // Xử lý kết quả nhận dạng
  useEffect(() => {
    if (!transcript) return;

    // Debounce nhẹ để người dùng nói xong câu (500ms ngắt quãng)
    const timer = setTimeout(() => {
      const command = parseVoiceCommand(transcript);
      console.log("Voice Command:", command, "Text:", transcript);

      if (command.type === "NEXT" || command.type === "CONFIRM") {
        // Commit actual=system trước khi next (không thì backend sẽ xuất trắng)
        if (activeItemId) {
          confirmItemMatching(activeItemId).finally(() => {
            moveToNextItem();
          });
        } else {
          moveToNextItem();
        }
        message.success("Đã xác nhận (Next)");
        resetTranscript();
      } else if (command.type === "UPDATE" && activeItemId) {
        const cmd = command as {
          type: string;
          box: number | null;
          unit: number | null;
        };

        // Lấy item hiện tại để biết số cũ
        const currentItem = items.find((i) => i.id === activeItemId);
        if (currentItem) {
          const newBox =
            cmd.box != null ? cmd.box : currentItem.input_wholesale_qty;
          const newUnit =
            cmd.unit != null ? cmd.unit : currentItem.input_base_qty;

          updateItemQuantity(activeItemId, {
            wholesale_qty: newBox,
            base_qty: newUnit,
          });
          message.success(`Đã nhập: ${newBox} chẵn, ${newUnit} lẻ`);

          resetTranscript();
        }
      } else if (command.type === "COMPLETE") {
        // onComplete(); // Tạm tắt để tránh rủi ro
        resetTranscript();
      }
    }, 800); // Đợi 800ms sau khi ngừng nói

    return () => clearTimeout(timer);
    // confirmItemMatching/moveToNextItem/resetTranscript/updateItemQuantity là stable Zustand actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, activeItemId, items]);
  // --- VOICE LOGIC END ---

  // [FIXED] QuantityInput Optimized for Mobile
  const QuantityInput = ({
    label,
    value,
    onChange,
    max,
  }: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    max?: number;
  }) => {
    const [localValue, setLocalValue] = useState<number | null>(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const commitChange = () => {
      if (localValue !== value) {
        onChange(localValue ?? 0);
      }
    };

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#555", flex: 1 }}>
          {label}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            overflow: "hidden",
            background: "#fff",
            height: 36,
          }}
        >
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={() => onChange(Math.max(0, (value || 0) - 1))}
            style={{
              height: 36,
              width: 36,
              background: "#f5f5f5",
              borderRadius: 0,
              borderRight: "1px solid #eee",
              padding: 0,
            }}
          />

          <InputNumber
            value={localValue}
            onChange={(val) => setLocalValue(val)}
            onBlur={commitChange}
            onPressEnter={(e) => {
              commitChange();
              (e.target as HTMLInputElement).blur();
            }}
            min={0}
            max={max}
            controls={false}
            inputMode="numeric"
            type="number"
            style={{
              width: 55,
              textAlign: "center",
              border: "none",
              boxShadow: "none",
              fontSize: 16,
              fontWeight: "bold",
              paddingTop: 2,
            }}
            onFocus={(e) => e.target.select()}
          />

          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={() => onChange((value || 0) + 1)}
            style={{
              height: 36,
              width: 36,
              background: "#f5f5f5",
              borderRadius: 0,
              borderLeft: "1px solid #eee",
              padding: 0,
            }}
          />
        </div>
      </div>
    );
  };

  // [FIXED] TrackingInput with stopPropagation
  const TrackingInput = ({
    label,
    value,
    type,
    onChange,
    disabled,
  }: {
    label: string;
    value: string;
    type: string;
    onChange: (val: string) => void;
    disabled?: boolean;
  }) => {
    const [localValue, setLocalValue] = useState<string | null>(value);

    // Sync from props
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
      if (localValue !== value) onChange(localValue ?? "");
    };

    return (
      <div
        style={{ marginBottom: 12 }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
          {label}
        </div>
        <Input
          size="middle" // Đổi từ large sang middle cho gọn
          type={type}
          value={localValue || ""}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onPressEnter={(e) => {
            handleBlur();
            (e.target as HTMLInputElement).blur();
          }}
          disabled={disabled}
        />
      </div>
    );
  };

  // --- SUB-COMPONENT: CARD SẢN PHẨM (Memoized) ---
  const ItemCard = memo(
    ({
      item,
      isActive,
      canDelete,
      onActivate,
      onUpdateQuantity,
      onRemoveItem,
      listening,
      transcript,
      itemRef,
    }: {
      item: InventoryCheckItem;
      isActive: boolean;
      canDelete: boolean;
      onActivate: (id: number) => void;
      onUpdateQuantity: (
        itemId: number,
        quantities: {
          wholesale_qty?: number;
          retail_qty?: number;
          base_qty?: number;
        },
        tracking?: { lot_number?: string; expiry_date?: string }
      ) => void;
      onRemoveItem: (id: number) => Promise<void>;
      listening: boolean;
      transcript: string;
      itemRef: (el: HTMLDivElement | null) => void;
    }) => {
      // Tính EXIST SYSTEM QTY để xem tham khảo (theo lô hoặc tổng SP)
      const sysQty = item.system_quantity || 0;
      const sysLabel = item.batch_code
        ? "Tồn hệ thống (lô này):"
        : "Tồn hệ thống (tổng SP):";
      const baseUnitLabel = item.base_unit_name || "Viên";
      let sysDisplay = `${sysQty} ${baseUnitLabel}`;

      // Auto-calculate sys display summary if large units exist
      if ((item.wholesale_unit_rate ?? 0) > 1) {
        const wRate = item.wholesale_unit_rate!;
        const sysBox = Math.floor(sysQty / wRate);
        const sysUnit = sysQty % wRate;
        sysDisplay = `${sysBox} ${item.wholesale_unit_name} ${sysUnit > 0 ? `- ${sysUnit} ${baseUnitLabel}` : ""}`;
      } else if ((item.retail_unit_rate ?? 0) > 1) {
        const rRate = item.retail_unit_rate!;
        const sysBox = Math.floor(sysQty / rRate);
        const sysUnit = sysQty % rRate;
        sysDisplay = `${sysBox} ${item.retail_unit_name} ${sysUnit > 0 ? `- ${sysUnit} ${baseUnitLabel}` : ""}`;
      }

      return (
        <div
          ref={itemRef}
          role="button"
          tabIndex={0}
          onClick={() => onActivate(item.id)}
          onKeyDown={(e) => e.key === "Enter" && onActivate(item.id)}
          style={{
            marginBottom: 16,
            border: isActive ? "2px solid #1890ff" : "1px solid #e8e8e8",
            borderRadius: 12, // Bo tròn nhiều hơn cho giống Mobile App
            padding: 16,
            backgroundColor: isActive ? "#f0f5ff" : "#fff",
            transition: "all 0.3s",
            transform: isActive ? "scale(1.02)" : "scale(1)", // Phóng to nhẹ khi focus
            boxShadow: isActive
              ? "0 8px 16px rgba(24,144,255,0.2)"
              : "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          {/* Header Card */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              {/* Vị trí in đậm to rõ */}
              <Tag
                color="geekblue"
                style={{
                  fontSize: 14,
                  padding: "4px 8px",
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                📍 {item.location_snapshot || "Chưa xếp vị trí"}
              </Tag>
              <Title level={5} style={{ margin: 0, lineHeight: 1.3 }}>
                {item.product_name}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Mã: {item.sku}
              </Text>
            </div>
            {/* Nút xóa */}
            {canDelete ? (
              <Button
                type="text"
                danger
                icon={<CloseCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveItem(item.id);
                }}
              />
            ) : null}
          </div>

          {/* Phần so sánh & Nhập liệu */}
          <div style={{ background: "#fafafa", padding: 10, borderRadius: 8 }}>
            {/* Dòng Tồn máy (Reference) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: 13,
                color: "#888",
              }}
            >
              <span>{sysLabel}</span>
              <span>
                <b>{sysDisplay}</b>
              </span>
            </div>

            {/* Vùng Nhập liệu (List View Dàn ngang siêu gọn) */}
            <div
              style={{
                borderTop: "1px dashed #e8e8e8",
                margin: "8px -10px 0 -10px",
                padding: "10px 10px 0 10px",
              }}
            >
              {item.wholesale_unit_name &&
              (item.wholesale_unit_rate ?? 0) > 1 ? (
                <QuantityInput
                  label={`ĐV Bán Buôn (${item.wholesale_unit_name})`}
                  value={item.input_wholesale_qty ?? 0}
                  onChange={(val: number) =>
                    onUpdateQuantity(item.id, { wholesale_qty: val })
                  }
                  max={99999}
                />
              ) : null}
              {item.retail_unit_name &&
              (item.retail_unit_rate ?? 0) > 1 &&
              item.retail_unit_name !== item.wholesale_unit_name ? (
                <QuantityInput
                  label={`ĐV Bán Lẻ (${item.retail_unit_name})`}
                  value={item.input_retail_qty ?? 0}
                  onChange={(val: number) =>
                    onUpdateQuantity(item.id, { retail_qty: val })
                  }
                  max={
                    (item.wholesale_unit_rate ?? 0) >
                    (item.retail_unit_rate ?? 0)
                      ? Math.floor(
                          (item.wholesale_unit_rate ?? 1) /
                            (item.retail_unit_rate ?? 1)
                        ) - 1
                      : 99999
                  }
                />
              ) : null}
              <QuantityInput
                label={`ĐV Cơ Sở (${item.base_unit_name || "Viên"})`}
                value={item.input_base_qty ?? 0}
                onChange={(val: number) =>
                  onUpdateQuantity(item.id, { base_qty: val })
                }
                max={
                  (item.retail_unit_rate ?? 0) > 1
                    ? (item.retail_unit_rate ?? 1) - 1
                    : 99999
                }
              />
            </div>

            {/* Lô / Hạn — đã có sẵn trên phiếu khi thêm SP nhiều lô; chỉnh khi đếm lại hoặc dòng thừa hàng */}
            <div
              style={{
                background: "#f0f5ff",
                borderRadius: 6,
                padding: 8,
                marginTop: 4,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1 }}>
                <TrackingInput
                  label="Số Lô"
                  type="text"
                  value={item.batch_code}
                  onChange={(val: string) =>
                    onUpdateQuantity(item.id, {}, { lot_number: val })
                  }
                  disabled={!canDelete}
                />
              </div>
              <div style={{ flex: 1 }}>
                <TrackingInput
                  label="Hạn SD"
                  type="date"
                  value={item.expiry_date ? item.expiry_date.slice(0, 10) : ""}
                  onChange={(val: string) =>
                    onUpdateQuantity(
                      item.id,
                      {},
                      {
                        expiry_date: val
                          ? new Date(val).toISOString()
                          : undefined,
                      }
                    )
                  }
                  disabled={!canDelete}
                />
              </div>
            </div>

            {/* NÚT TÁCH LÔ MỚI */}
            {canDelete ? (
              <div style={{ textAlign: "right", marginTop: 8 }}>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    useInventoryCheckStore
                      .getState()
                      .splitCheckItem(item.id, item.product_id);
                  }}
                >
                  Thêm dòng thừa hàng / lô mới
                </Button>
              </div>
            ) : null}

            {/* Dòng Chênh lệch (Feedback Real-time) */}
            <div style={{ marginTop: 8, textAlign: "right", height: 20 }}>
              {(item.diff_quantity ?? 0) !== 0 ? (
                <Text
                  type={(item.diff_quantity ?? 0) > 0 ? "success" : "danger"}
                  strong
                >
                  {(item.diff_quantity ?? 0) > 0 ? "Thừa" : "Thiếu"}:{" "}
                  {(item.diff_quantity ?? 0) > 0 ? "+" : ""}
                  {item.diff_quantity ?? 0} {item.base_unit_name || "Viên"}
                </Text>
              ) : (
                <Text type="success" style={{ fontSize: 12 }}>
                  <CheckCircleOutlined /> Khớp số liệu
                </Text>
              )}
            </div>
            {/* KPI Display */}
            {item.counted_at ? (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px dashed #eee",
                  fontSize: 11,
                  color: "#999",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <UserOutlined />{" "}
                <span>
                  Đã kiểm lúc{" "}
                  {new Date(item.counted_at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ) : null}
          </div>

          {/* Voice Indicator (Chỉ hiện khi Active) */}
          {isActive ? (
            <div
              style={{
                marginTop: 8,
                textAlign: "center",
                color: "#1890ff",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <AudioOutlined />{" "}
              <span>
                {listening
                  ? transcript || "Đang nghe..."
                  : "Nhấn Mic để nói lệnh"}
              </span>
            </div>
          ) : null}
        </div>
      );
    },
    (prev, next) => {
      // Custom comparison for memo
      return (
        prev.item.id === next.item.id &&
        prev.item.actual_quantity === next.item.actual_quantity &&
        prev.item.system_quantity === next.item.system_quantity &&
        prev.item.batch_code === next.item.batch_code &&
        prev.isActive === next.isActive &&
        prev.listening === next.listening &&
        prev.transcript === next.transcript
      );
    }
  );
  ItemCard.displayName = "ItemCard";

  // Hàm xử lý hoàn tất
  const onComplete = () => {
    Modal.confirm({
      title: "Hoàn tất kiểm kê?",
      content:
        "Hệ thống sẽ cập nhật lại tồn kho theo số liệu bạn đã nhập. Hành động này không thể hoàn tác.",
      onOk: () => user && completeSession(user.id),
    });
  };

  // Logic Hủy
  const onCancelSession = () => {
    Modal.confirm({
      title: "Hủy phiếu kiểm kê?",
      content:
        "Dữ liệu đã nhập sẽ không được lưu vào kho. Hành động này không thể hoàn tác.",
      okText: "Xác nhận Hủy",
      okType: "danger",
      onOk: async () => {
        await cancelSession();
        message.success("Đã hủy phiếu");
        navigate("/inventory/stocktake"); // Quay về list
      },
    });
  };

  // Logic Lưu tạm (Chỉ lưu note, ko chốt kho)
  const onSaveDraft = () => {
    if (activeSession) {
      saveCheckInfo(activeSession.note || "");
    }
  };

  if (!browserSupportsSpeechRecognition) {
    // Fallback nếu trình duyệt không hỗ trợ
    // console.warn("Trình duyệt không hỗ trợ Speech Recognition");
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {/* HEADER */}
      <Header
        style={{
          background: "#fff",
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "1px solid #ddd",
          height: 60,
          gap: 12,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
        />
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Trên Mobile chỉ hiện Mã phiếu, ẩn text phụ */}
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: "20px",
            }}
          >
            {activeSession?.code || "Đang tải..."}
          </div>
          {/* Chỉ hiện dòng này khi màn hình >= sm (Tablets trở lên) */}
          {screens.sm ? (
            <Text type="secondary" style={{ fontSize: 11, lineHeight: "14px" }}>
              {items.length} dòng cần kiểm
            </Text>
          ) : null}
        </div>
        <Space>
          {activeSession?.status === "DRAFT" && (
            <>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={onCancelSession}
              >
                {!screens.xs && "Hủy"}
              </Button>
              <Button icon={<SaveOutlined />} onClick={onSaveDraft}>
                {!screens.xs && "Lưu"}
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onComplete}
              >
                Hoàn tất
              </Button>
            </>
          )}
        </Space>
      </Header>

      {/* CONTENT */}
      <Content style={{ padding: "12px", paddingBottom: 100 }}>
        {/* [UPDATE] STICKY SEARCH BAR - GHIM LẠI KHI CUỘN */}
        {activeSession?.status === "DRAFT" && (
          <div
            style={{
              position: "sticky", // [FIX] Ghim thanh tìm kiếm
              top: 60, // Cách top 60px (chiều cao Header)
              zIndex: 99, // Nổi lên trên items
              marginBottom: 16,
              background: "#f0f2f5", // Trùng màu nền để che nội dung trôi qua
              paddingBottom: 8, // Tạo khoảng cách
              paddingTop: 8, // Tạo khoảng cách
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "12px 16px",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                border: "1px solid #e6f7ff",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#0050b3",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <PlusOutlined /> Thêm sản phẩm ngoài danh sách
              </div>
              <Text
                type="secondary"
                style={{ fontSize: 12, display: "block", marginBottom: 8 }}
              >
                Mỗi lô còn tồn trong kho được tách thành một dòng riêng trên
                phiếu. Dòng không gắn lô là kiểm theo tổng sản phẩm.
              </Text>

              <DebounceSelect
                showSearch
                placeholder="Gõ tên thuốc (VD: panadol...)"
                fetchOptions={async (search: string) => {
                  if (!activeSession?.warehouse_id || !search) return [];
                  try {
                    const res = await inventoryService.searchProductForCheck(
                      search,
                      activeSession.warehouse_id
                    );
                    if (!res) return [];
                    type PRow = {
                      id: number;
                      name: string;
                      sku: string;
                      image_url?: string;
                      system_stock?: number;
                      items_per_carton?: number;
                      retail_unit?: string;
                      unit?: string;
                      wholesale_unit?: string;
                    };
                    const rows = res as unknown as PRow[];
                    const lotCounts = await Promise.all(
                      rows.map((p) =>
                        inventoryService
                          .searchProductBatchesForStocktake(
                            p.id,
                            activeSession.warehouse_id!
                          )
                          .then((b) => (Array.isArray(b) ? b.length : 0))
                      )
                    );
                    return rows.map((p, idx) => {
                      const rate = p.items_per_carton || 1;
                      const stock = Number(p.system_stock || 0);
                      const box = Math.floor(stock / rate);
                      const unit = stock % rate;
                      const nLots = lotCounts[idx] ?? 0;

                      // [FIX] Uu tien hien thi retail_unit ("Vi") thay vi unit mac dinh ("Vien")
                      const retailUnitName = p.retail_unit || p.unit || "Le";
                      const wholesaleUnitName = p.wholesale_unit || "Hop";

                      let stockDisplay = "";
                      if (stock <= 0) {
                        stockDisplay = "Het hang";
                      } else {
                        const parts: string[] = [];
                        if (box > 0) parts.push(`${box} ${wholesaleUnitName}`);
                        if (unit > 0) parts.push(`${unit} ${retailUnitName}`);
                        stockDisplay = parts.join(" - ");
                      }

                      return {
                        value: p.id as number,
                        key: String(p.id),
                        label: (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "4px 0",
                            }}
                          >
                            <Avatar
                              shape="square"
                              size={48}
                              src={p.image_url || undefined}
                              icon={<PictureOutlined />}
                              style={{
                                flexShrink: 0,
                                border: "1px solid #f0f0f0",
                                backgroundColor: "#fafafa",
                              }}
                            />
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 14,
                                  lineHeight: 1.2,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: 4,
                                }}
                              >
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {p.sku}
                                </Text>
                                <Space size={4}>
                                  <Tag
                                    color={nLots > 0 ? "purple" : "default"}
                                    style={{ marginRight: 0, fontSize: 11 }}
                                  >
                                    {nLots > 0 ? `${nLots} lô` : "Tổng SP"}
                                  </Tag>
                                  <Tag
                                    color={stock > 0 ? "blue" : "red"}
                                    style={{ marginRight: 0, fontSize: 11 }}
                                  >
                                    {stockDisplay}
                                  </Tag>
                                </Space>
                              </div>
                            </div>
                          </div>
                        ),
                      };
                    });
                  } catch {
                    return [];
                  }
                }}
                style={{ width: "100%" }}
                onChange={(newValue: unknown) => {
                  if (
                    newValue &&
                    typeof newValue === "object" &&
                    "value" in newValue
                  ) {
                    addItemToCheck(
                      Number((newValue as { value: number }).value)
                    );
                  }
                }}
                value={null}
              />
            </div>
          </div>
        )}
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isActive={item.id === activeItemId}
            canDelete={activeSession?.status === "DRAFT"}
            onActivate={setActiveItem}
            onUpdateQuantity={updateItemQuantity}
            onRemoveItem={removeItem}
            listening={listening}
            transcript={transcript}
            itemRef={(el: HTMLDivElement | null) => {
              itemRefs.current[item.id] = el;
            }}
          />
        ))}
      </Content>

      {/* VOICE FLOATING BUTTON */}
      <div style={{ position: "fixed", bottom: 90, right: 20, zIndex: 999 }}>
        <Button
          type="primary"
          shape="circle"
          size="large"
          danger={listening} // Màu đỏ khi đang nghe
          style={{
            width: 64,
            height: 64,
            boxShadow: listening
              ? "0 0 15px rgba(255, 77, 79, 0.6)"
              : "0 6px 16px rgba(24, 144, 255, 0.4)",
            border: "2px solid #fff",
            transition: "all 0.3s",
          }}
          icon={<AudioOutlined style={{ fontSize: 28 }} />}
          onClick={toggleListening}
        />
      </div>

      {/* FOOTER NAVIGATION */}
      <Footer
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          background: "#fff",
          borderTop: "1px solid #ddd",
          padding: "12px",
          display: "flex",
          gap: 12,
          zIndex: 100,
        }}
      >
        <Button size="small" style={{ flex: 1 }} onClick={moveToNextItem}>
          Bỏ qua (Next)
        </Button>
        <Button
          type="primary"
          size="small"
          style={{
            flex: 1,
            background: "#a0d911",
            borderColor: "#a0d911",
            color: "#fff",
            fontWeight: "bold",
          }}
          onClick={async () => {
            // CRITICAL: commit actual=system xuống DB trước khi next,
            // không thì backend sẽ xuất TRẮNG toàn bộ tồn (bug 4/2026).
            if (activeItemId) {
              await confirmItemMatching(activeItemId);
            }
            moveToNextItem();
          }}
        >
          <CheckCircleOutlined /> Đủ / OK
        </Button>
      </Footer>
    </Layout>
  );
};

export default InventoryCheckDetail;
