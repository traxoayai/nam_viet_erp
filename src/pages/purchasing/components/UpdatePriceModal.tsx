// src/pages/purchasing/components/UpdatePriceModal.tsx
import { ArrowRightOutlined } from "@ant-design/icons";
import { Modal, Table, InputNumber, Button, message, Tag, Typography } from "antd";
import React, { useEffect, useState } from "react";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
import { formatCurrency } from "@/shared/utils/format";

const { Text } = Typography;

interface Props {
  visible: boolean;
  onClose: () => void;
  costingItems: any[];
  oldCosts: any[];
}

interface PriceRow {
  key: string;
  product_id: number;
  product_name: string;

  // Base cost per smallest unit (viên)
  old_base_cost: number;
  new_base_cost: number;

  // Wholesale
  has_wholesale: boolean;
  wholesale_unit_name: string;
  wholesale_rate: number;
  current_wholesale_price: number;
  new_wholesale_price: number;

  // Retail
  retail_unit_name: string;
  retail_rate: number;
  current_retail_price: number;
  new_retail_price: number;
}

export const UpdatePriceModal: React.FC<Props> = ({
  visible,
  onClose,
  costingItems,
  oldCosts,
}) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (visible && costingItems.length > 0) {
      fetchComparisonData();
    }
  }, [visible, costingItems]);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      const productIds = [...new Set(costingItems.map((i) => i.product_id))];

      const { data: products } = await supabase
        .from("products")
        .select(
          `id, name, actual_cost, wholesale_unit, retail_unit,
           wholesale_margin_value, wholesale_margin_type,
           retail_margin_value, retail_margin_type,
           product_units(*)`
        )
        .in("id", productIds);

      const newRows: PriceRow[] = [];
      const defaultSelected: React.Key[] = [];

      products?.forEach((p) => {
        const inputItem = costingItems.find((i) => i.product_id === p.id);
        if (!inputItem) return;

        // === BUG FIX: Lookup conversion_rate từ product_units thay vì dùng conversion_factor ===
        const importUnit = p.product_units.find(
          (u: any) => u.unit_name === inputItem.unit
        );
        const importRate = importUnit?.conversion_rate || 1;
        const newBaseCost = inputItem.final_unit_cost / importRate;

        // === Xác định đơn vị Bán buôn và Bán lẻ ===
        const wholesaleUnitObj =
          p.product_units.find((u: any) => u.unit_name === p.wholesale_unit) ||
          p.product_units.find((u: any) => u.unit_type === "wholesale");

        const retailUnitObj =
          p.product_units.find((u: any) => u.unit_name === p.retail_unit) ||
          p.product_units.find((u: any) => u.is_base) ||
          p.product_units[0];

        if (!retailUnitObj) return;

        const wholesaleRate = wholesaleUnitObj?.conversion_rate || 1;
        const retailRate = retailUnitObj?.conversion_rate || 1;
        const hasWholesale =
          !!wholesaleUnitObj &&
          wholesaleUnitObj.id !== retailUnitObj.id;

        // === Giá vốn cũ từ Snapshot ===
        const snapshot = oldCosts.find((o) => o.id === p.id);
        const oldBaseCost = snapshot ? snapshot.actual_cost : p.actual_cost || 0;

        // === Tính giá đề xuất theo Lãi (pattern từ QuickPricePage) ===
        const wholesaleCost = newBaseCost * wholesaleRate;

        // Giá Bán Sỉ đề xuất
        let suggestedWholesalePrice = wholesaleUnitObj?.price_sell || wholesaleUnitObj?.price || 0;
        if (hasWholesale) {
          const wMarginVal = p.wholesale_margin_value || 0;
          const wMarginType = p.wholesale_margin_type;
          let wMargin = wMarginVal;
          if (wMarginType === "%" || wMarginType === "percent") {
            wMargin = wholesaleCost * (wMarginVal / 100);
          }
          suggestedWholesalePrice = Math.ceil(wholesaleCost + wMargin);
        }

        // Giá Bán Lẻ đề xuất: [Giá Vốn + Lãi Lẻ / wholesale_rate] * retail_rate
        let suggestedRetailPrice = retailUnitObj?.price_sell || retailUnitObj?.price || 0;
        const rMarginVal = p.retail_margin_value || 0;
        const rMarginType = p.retail_margin_type;
        let rMargin = rMarginVal;
        if (rMarginType === "%" || rMarginType === "percent") {
          rMargin = wholesaleCost * (rMarginVal / 100);
        }
        const pricePerWholesale = wholesaleCost + rMargin;
        const pricePerBase = pricePerWholesale / wholesaleRate;
        suggestedRetailPrice = Math.ceil(pricePerBase * retailRate);

        // === Auto-select nếu giá vốn thay đổi > 1% ===
        const costRatio = oldBaseCost > 0 ? newBaseCost / oldBaseCost : 1;
        const rowKey = p.id.toString();

        newRows.push({
          key: rowKey,
          product_id: p.id,
          product_name: p.name,

          old_base_cost: oldBaseCost,
          new_base_cost: newBaseCost,

          has_wholesale: hasWholesale,
          wholesale_unit_name: wholesaleUnitObj?.unit_name || "-",
          wholesale_rate: wholesaleRate,
          current_wholesale_price: wholesaleUnitObj?.price_sell || wholesaleUnitObj?.price || 0,
          new_wholesale_price: suggestedWholesalePrice,

          retail_unit_name: retailUnitObj?.unit_name || "ĐV",
          retail_rate: retailRate,
          current_retail_price: retailUnitObj?.price_sell || retailUnitObj?.price || 0,
          new_retail_price: suggestedRetailPrice,
        });

        if (Math.abs(costRatio - 1) > 0.01) {
          defaultSelected.push(rowKey);
        }
      });

      setRows(newRows);
      setSelectedRowKeys(defaultSelected);
    } catch (error) {
      console.error(error);
      message.error("Lỗi lấy dữ liệu giá");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const selectedRows = rows.filter((r) => selectedRowKeys.includes(r.key));
      if (selectedRows.length === 0) {
        onClose();
        return;
      }

      const payload = selectedRows.map((row) => ({
        product_id: row.product_id,
        retail_price: row.new_retail_price,
        wholesale_price: row.has_wholesale ? row.new_wholesale_price : null,
      }));

      await safeRpc("bulk_update_product_prices", { p_data: payload });

      message.success(
        `Thành công! Đã cập nhật giá bán mới cho ${selectedRows.length} sản phẩm.`
      );
      onClose();
    } catch (error: any) {
      message.error(`Lỗi hệ thống: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const numberFormatter = (value: number | undefined) =>
    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const numberParser = (value: string | undefined) =>
    value!.replace(/\$\s?|(,*)/g, "") as unknown as number;

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 200,
      render: (text: string, r: PriceRow) => (
        <div>
          <b>{text}</b>
          <div style={{ fontSize: 12, color: "#666" }}>
            Lẻ: {r.retail_unit_name}
            {r.has_wholesale && ` | Buôn: ${r.wholesale_unit_name}`}
          </div>
        </div>
      ),
    },
    {
      title: "Giá Vốn (1 ĐVCS)",
      width: 200,
      render: (_: any, r: PriceRow) => {
        const diff =
          r.old_base_cost > 0
            ? ((r.new_base_cost - r.old_base_cost) / r.old_base_cost) * 100
            : 100;
        const color = diff > 0 ? "red" : "green";
        const icon = diff > 0 ? "↗" : "↘";

        if (Math.abs(diff) < 0.1) return <Tag>Không đổi</Tag>;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#999" }}>
              {formatCurrency(r.old_base_cost)} <ArrowRightOutlined />{" "}
              <b>{formatCurrency(r.new_base_cost)}</b>
            </div>
            <Tag color={color}>
              {icon} {Math.abs(diff).toFixed(1)}%
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Giá Bán Lẻ",
      width: 200,
      render: (_: any, record: PriceRow) => (
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>
            {record.retail_unit_name} (Hiện: {formatCurrency(record.current_retail_price)})
          </div>
          <InputNumber
            value={record.new_retail_price}
            style={{
              width: "100%",
              fontWeight: "bold",
              borderColor:
                record.new_retail_price !== record.current_retail_price
                  ? "#1677ff"
                  : "#d9d9d9",
            }}
            formatter={numberFormatter}
            parser={numberParser}
            onChange={(v) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.key === record.key
                    ? { ...r, new_retail_price: Number(v) }
                    : r
                )
              );
              if (!selectedRowKeys.includes(record.key)) {
                setSelectedRowKeys((prev) => [...prev, record.key]);
              }
            }}
          />
        </div>
      ),
    },
    {
      title: "Giá Bán Buôn",
      width: 200,
      render: (_: any, record: PriceRow) => {
        if (!record.has_wholesale)
          return <Text type="secondary">Không bán buôn</Text>;
        return (
          <div>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>
              {record.wholesale_unit_name} (Hiện:{" "}
              {formatCurrency(record.current_wholesale_price)})
            </div>
            <InputNumber
              value={record.new_wholesale_price}
              style={{
                width: "100%",
                fontWeight: "bold",
                borderColor:
                  record.new_wholesale_price !== record.current_wholesale_price
                    ? "#52c41a"
                    : "#d9d9d9",
              }}
              formatter={numberFormatter}
              parser={numberParser}
              onChange={(v) => {
                setRows((prev) =>
                  prev.map((r) =>
                    r.key === record.key
                      ? { ...r, new_wholesale_price: Number(v) }
                      : r
                  )
                );
                if (!selectedRowKeys.includes(record.key)) {
                  setSelectedRowKeys((prev) => [...prev, record.key]);
                }
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      title="Cập nhật Giá bán lẻ & Bán buôn (Dựa trên Lợi nhuận cài đặt)"
      open={visible}
      onCancel={onClose}
      width={1100}
      maskClosable={false}
      footer={[
        <Button key="close" onClick={onClose}>
          Bỏ qua
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={loading}
        >
          Lưu Giá Mới ({selectedRowKeys.length})
        </Button>,
      ]}
    >
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ y: 400 }}
        rowKey="key"
      />
    </Modal>
  );
};
