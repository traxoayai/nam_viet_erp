import { DeleteOutlined, PictureOutlined, WarningOutlined } from "@ant-design/icons";
import {
  Table,
  Card,
  Button,
  InputNumber,
  Select,
  Space,
  Typography,
  Grid,
  Avatar,
  Form,
  Input,
  DatePicker,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import React from "react";

// FIX: Import POItem để định nghĩa kiểu dữ liệu chính xác
import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";

const { useBreakpoint } = Grid;
const { Text } = Typography;
const { Option } = Select;

interface Props {
  items: POItem[];
  // FIX: Định nghĩa field là 'keyof POItem' thay vì string
  onItemChange: (index: number, field: keyof POItem, value: any) => void;
  onRemove: (index: number) => void;
}

const POProductTable: React.FC<Props> = ({ items, onItemChange, onRemove }) => {
  const screens = useBreakpoint();
  const DATE_FORMATS = ["DD/MM/YYYY", "DDMMYY", "DDMMYYYY"];

  // Helper: Render Unit Select (Shared between Mobile & Desktop)
  const renderUnitSelect = (item: POItem, idx: number) => {
    // Ưu tiên hiển thị giá trị đang chọn
    const currentValue = item.uom;

    // Defensive: nếu giá trị đang lưu (uom) không nằm trong available_units
    // → vẫn render thêm option đó để user thấy/giữ nguyên (tránh Ant Select
    //   tự fallback option đầu khi value không match — gốc bug "Tub" → "Hộp").
    const hasInAvailable = item.available_units?.some(
      (u) => u.unit_name === currentValue
    );
    const hasInLegacy =
      currentValue === item._wholesale_unit ||
      currentValue === item._retail_unit;
    const showStickyOption =
      !!currentValue &&
      ((item.available_units &&
        item.available_units.length > 0 &&
        !hasInAvailable) ||
        (!item.available_units?.length && !hasInLegacy));

    return (
      <Select
        value={currentValue}
        style={{ width: "100%" }}
        popupMatchSelectWidth={false} // Để dropdown không bị cắt chữ nếu dài
        onChange={(val) => {
          // 1. Cập nhật đơn vị mới cho State
          onItemChange(idx, "uom", val);

          // 2. [Optional] Tìm unit trong mảng để cập nhật giá gợi ý (nếu cần)
          // const selectedUnit = item.available_units?.find(u => u.unit_name === val);
          // if (selectedUnit && selectedUnit.price_sell) {
          //    onItemChange(idx, "unit_price", selectedUnit.price_sell);
          // }
        }}
      >
        {showStickyOption ? (
          <Option key="__sticky_current" value={currentValue}>
            {currentValue} (đã lưu)
          </Option>
        ) : null}
        {/* LOGIC MỚI: Render từ mảng available_units trả về từ API */}
        {item.available_units && item.available_units.length > 0 ? (
          item.available_units.map((u) => (
            <Option key={u.id} value={u.unit_name}>
              {u.unit_name}{" "}
              {u.conversion_rate > 1 ? `(x${u.conversion_rate})` : ""}
            </Option>
          ))
        ) : (
          /* Fallback cho dữ liệu cũ (Legacy) */
          <>
            <Option value={item._wholesale_unit}>{item._wholesale_unit}</Option>
            {item._retail_unit && item._retail_unit !== item._wholesale_unit ? (
              <Option value={item._retail_unit}>{item._retail_unit}</Option>
            ) : null}
          </>
        )}
      </Select>
    );
  };

  // Helper: Render Stock in Wholesale Unit
  const renderStock = (item: POItem) => {
    if (item.total_stock == null) return "Tồn: 0";
    
    const wholesaleUnit = item.available_units?.find(u => u.unit_name === item._wholesale_unit);
    if (wholesaleUnit && wholesaleUnit.conversion_rate > 0) {
      const stockInWholesale = item.total_stock / wholesaleUnit.conversion_rate;
      return `Tồn: ${stockInWholesale.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${wholesaleUnit.unit_name}`;
    }
    
    return `Tồn: ${item.total_stock.toLocaleString()}`;
  };

  // --- RENDER MOBILE VIEW (CARD LIST) ---
  if (!screens.md) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, idx) => (
          <Card
            key={item.product_id}
            size="small"
            styles={{
              body: {
                padding: 8,
                background: item.is_ai_suggested ? "#fffbe6" : undefined,
              },
            }}
            style={
              item.is_ai_suggested ? { borderColor: "#ffe58f" } : undefined
            }
          >
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Avatar
                shape="square"
                size={64}
                src={item.image_url}
                icon={<PictureOutlined />}
                style={{
                  backgroundColor: "#f5f5f5",
                  border: "1px solid #d9d9d9",
                }}
              />
              <div style={{ flex: 1 }}>
                <Text strong>{item.name}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.sku}
                  </Text>
                  <Text
                    style={{ fontSize: 11, marginLeft: 8 }}
                    type={
                      item.total_stock && item.total_stock > 0
                        ? "secondary"
                        : "danger"
                    }
                  >
                    {renderStock(item)}
                  </Text>
                  <span style={{ color: "#8c8c8c", fontSize: "12px", marginLeft: 8 }}>
                    TB: {item.formatted_monthly_sales_qty ? `${item.formatted_monthly_sales_qty}/th` : `${(item.avg_monthly_sold ?? 0).toLocaleString()}/th`}
                  </span>
                </div>
              </div>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onRemove(idx)}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <Form.Item label="ĐVT" style={{ width: 250, marginBottom: 0 }}>
                {renderUnitSelect(item, idx)}
              </Form.Item>

              <Form.Item label="SL" style={{ width: 100, marginBottom: 0 }}>
                <InputNumber
                  value={item.quantity}
                  min={1}
                  style={{ width: "100%" }}
                  onChange={(val) => onItemChange(idx, "quantity", val)}
                />
              </Form.Item>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <Form.Item label="Lô" style={{ width: 100, marginBottom: 0 }}>
                <Input
                  placeholder="Số Lô"
                  value={item.input_lot}
                  onChange={(e) =>
                    onItemChange(idx, "input_lot", e.target.value)
                  }
                />
              </Form.Item>
              <Form.Item label="HSD" style={{ width: 130, marginBottom: 0 }}>
                <DatePicker
                  placeholder="Hạn SD"
                  format={DATE_FORMATS}
                  value={
                    item.input_expiry &&
                    dayjs(item.input_expiry, DATE_FORMATS[0]).isValid()
                      ? dayjs(item.input_expiry, DATE_FORMATS[0])
                      : null
                  }
                  onChange={(_, dateString) =>
                    onItemChange(idx, "input_expiry", dateString)
                  }
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <InputNumber
                  value={item.unit_price}
                  style={{ width: 120 }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) =>
                    v!.replace(/\$\s?|(,*)/g, "") as unknown as number
                  }
                  onChange={(val) => onItemChange(idx, "unit_price", val)}
                  addonAfter="₫"
                  status={item.expected_pre_vat_price !== undefined && item.unit_price !== item.expected_pre_vat_price && item.expected_pre_vat_price > 0 ? "warning" : undefined}
                />
                {item.expected_pre_vat_price !== undefined && item.unit_price !== item.expected_pre_vat_price && item.expected_pre_vat_price > 0 && (
                  <div style={{ fontSize: 11, color: "#faad14", marginTop: 4 }}>
                    <WarningOutlined /> Lệch: {new Intl.NumberFormat("vi-VN").format(item.expected_pre_vat_price)}đ
                  </div>
                )}
              </div>
              <Text strong style={{ fontSize: 16, color: "#1677ff" }}>
                {(item.quantity * item.unit_price).toLocaleString()} ₫
              </Text>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            Chưa có sản phẩm
          </div>
        )}
      </div>
    );
  }

  // --- RENDER DESKTOP VIEW (TABLE) ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      width: 300,
      render: (_: any, r: POItem) => (
        <Space>
          <Avatar
            shape="square"
            size={48}
            src={r.image_url}
            icon={<PictureOutlined />}
            style={{
              backgroundColor: "#f5f5f5",
              border: "1px solid #747474ff",
            }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{r.sku}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "Tồn kho",
      width: 80,
      align: "center" as const,
      render: (_: any, r: POItem) => (
        <Text type={r.total_stock && r.total_stock > 0 ? undefined : "danger"}>
          {renderStock(r).replace("Tồn: ", "")}
        </Text>
      ),
    },
    {
      title: "TB bán/tháng",
      width: 100,
      align: "center" as const,
      render: (_: any, r: POItem) => (
        <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
          {r.formatted_monthly_sales_qty ? r.formatted_monthly_sales_qty : (r.avg_monthly_sold ?? 0).toLocaleString()}
        </div>
      ),
    },
    {
      title: "ĐVT",
      width: 130,
      render: (_: any, r: POItem, idx: number) => renderUnitSelect(r, idx),
    },
    {
      title: "Số lượng",
      width: 100,
      render: (_: any, r: POItem, idx: number) => (
        <InputNumber
          value={r.quantity}
          min={1}
          style={{ width: "100%" }}
          onChange={(val) => onItemChange(idx, "quantity", val)}
        />
      ),
    },

    {
      title: "Đơn giá",
      width: 150,
      render: (_: any, r: POItem, idx: number) => {
        const isPriceVariance = r.expected_pre_vat_price !== undefined && r.unit_price !== r.expected_pre_vat_price && r.expected_pre_vat_price > 0;
        return (
          <Space direction="vertical" size={2} style={{ width: "100%" }}>
            <InputNumber
              value={r.unit_price}
              style={{ width: "100%" }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(v) => v!.replace(/\$\s?|(,*)/g, "") as unknown as number}
              onChange={(val) => onItemChange(idx, "unit_price", val)}
              addonAfter="₫"
              disabled={r.is_bonus}
              status={isPriceVariance ? "warning" : undefined}
            />
            {isPriceVariance && (
              <div style={{ fontSize: 11, color: "#faad14", display: "flex", alignItems: "center", gap: 4 }}>
                <WarningOutlined />
                <Tooltip title={`Giá trên Master Data: ${new Intl.NumberFormat("vi-VN").format(r.expected_pre_vat_price!)}đ`}>
                  <span style={{ cursor: "help" }}>Giá lệch Ánh xạ</span>
                </Tooltip>
              </div>
            )}
          </Space>
        );
      },
    },
    // {
    //   title: "Hàng tặng", // [NEW] Bonus Column
    //   width: 90,
    //   align: "center" as const,
    //   render: (_: any, r: POItem, idx: number) => (
    //     <Checkbox
    //       checked={r.is_bonus}
    //       onChange={(e) => {
    //         const val = e.target.checked;
    //         onItemChange(idx, "is_bonus", val);
    //         if (val) onItemChange(idx, "unit_price", 0);
    //       }}
    //     />
    //   ),
    // },

    {
      title: "Thành tiền",
      align: "right" as const,
      width: 150,
      render: (_: any, r: POItem) => (
        <Text strong>{(r.quantity * r.unit_price).toLocaleString()} ₫</Text>
      ),
    },
    {
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(idx)}
        />
      ),
    },
    {
      title: "Số Lô",
      width: 100,
      render: (_: any, r: POItem, idx: number) => (
        <Input
          placeholder="Số Lô"
          value={r.input_lot}
          onChange={(e) => onItemChange(idx, "input_lot", e.target.value)}
        />
      ),
    },
    {
      title: "Hạn sử dụng",
      width: 130,
      render: (_: any, r: POItem, idx: number) => {
        const parsedDate =
          r.input_expiry && dayjs(r.input_expiry, DATE_FORMATS[0]).isValid()
            ? dayjs(r.input_expiry, DATE_FORMATS[0])
            : null;
        return (
          <DatePicker
            placeholder="Hạn SD"
            format={DATE_FORMATS}
            value={parsedDate}
            onChange={(_, dateString) =>
              onItemChange(idx, "input_expiry", dateString)
            }
            style={{ width: "100%" }}
          />
        );
      },
    },
  ];

  return (
    <>
      <Table
        dataSource={items}
        columns={columns}
        rowKey="product_id"
        pagination={false}
        scroll={{ y: 500 }}
        rowClassName={(record) =>
          record.is_ai_suggested ? "ai-suggested-row" : ""
        }
      />
      <style>{`
      .ai-suggested-row > td {
        background-color: #fffbe6 !important;
      }
    `}</style>
    </>
  );
};

export default React.memo(POProductTable);
