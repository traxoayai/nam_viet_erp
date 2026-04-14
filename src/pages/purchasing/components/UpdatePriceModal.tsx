// src/pages/purchasing/components/UpdatePriceModal.tsx
import { ArrowRightOutlined } from "@ant-design/icons";
import { Modal, Table, InputNumber, Button, message, Tag, Typography } from "antd";
import React, { useEffect, useState } from "react";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
import { resolveProductUnits, type ProductUnit } from "@/pages/purchasing/utils/resolveProductUnits";
import { formatCurrency } from "@/shared/utils/format";

const { Text } = Typography;

interface Props {
  visible: boolean;
  onClose: () => void;
  costingItems: unknown[];
  oldCosts: unknown[];
}

interface PriceRow {
  key: string;
  product_id: number;
  product_name: string;

  // Base cost per smallest unit (viên)
  old_base_cost: number;
  new_base_cost: number;

  // Cost per wholesale unit (for display)
  old_wholesale_cost: number;
  new_wholesale_cost: number;

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

  // Margins (VND amounts, at wholesale unit level — matches DB storage)
  retail_margin: number;
  wholesale_margin: number;
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
    if (visible && (costingItems as unknown[]).length > 0) {
      fetchComparisonData();
    }
  }, [visible, costingItems]);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      const items = costingItems as Record<string, unknown>[];
      const productIds = [...new Set(items.map((i) => i.product_id as number))];

      const itemIds = items.map((i) => i.id as number).filter(Boolean);
      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("id, product_id, uom_ordered, unit, conversion_factor")
        .in("id", itemIds);

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

      products?.forEach((p: Record<string, unknown>) => {
        const inputItem = items.find((i) => i.product_id === p.id) as Record<string, unknown> | undefined;
        if (!inputItem) return;

        const poItem = poItems?.find((pi: Record<string, unknown>) => pi.product_id === p.id) as Record<string, unknown> | undefined;
        const importUnitName = inputItem.unit || poItem?.uom_ordered || poItem?.unit || p.wholesale_unit;
        const units = p.product_units as unknown as ProductUnit[];
        const importUnit = units.find(
          (u) => u.unit_name === importUnitName
        );
        const importRate =
          (importUnit?.conversion_rate as number) ||
          (poItem?.conversion_factor as number) ||
          (inputItem.conversion_factor as number) ||
          1;
        const newBaseCost = (inputItem.final_unit_cost as number) / importRate;

        const { wholesaleUnitObj, retailUnitObj, hasWholesale, wholesaleRate, retailRate } =
          resolveProductUnits({
            wholesale_unit: p.wholesale_unit as string | null,
            retail_unit: p.retail_unit as string | null,
            product_units: units,
          });

        if (!retailUnitObj) return;

        const snapshot = (oldCosts as Record<string, unknown>[]).find((o) => o.id === p.id);
        const oldBaseCost = snapshot
          ? (snapshot.actual_cost as number)
          : (p.actual_cost as number) || 0;

        // Wholesale costs
        const wholesaleCost = newBaseCost * wholesaleRate;
        const oldWholesaleCost = oldBaseCost * wholesaleRate;

        // Compute wholesale margin (VND)
        const wMarginVal = (p.wholesale_margin_value as number) || 0;
        const wMarginType = p.wholesale_margin_type as string;
        let wMargin = wMarginVal;
        if (wMarginType === "%" || wMarginType === "percent") {
          wMargin = wholesaleCost * (wMarginVal / 100);
        }

        // Compute retail margin (VND)
        const rMarginVal = (p.retail_margin_value as number) || 0;
        const rMarginType = p.retail_margin_type as string;
        let rMargin = rMarginVal;
        if (rMarginType === "%" || rMarginType === "percent") {
          rMargin = wholesaleCost * (rMarginVal / 100);
        }

        // Suggested wholesale price
        let suggestedWholesalePrice =
          wholesaleUnitObj?.price_sell || wholesaleUnitObj?.price || 0;
        if (hasWholesale) {
          suggestedWholesalePrice = Math.ceil(wholesaleCost + wMargin);
        }

        // Suggested retail price
        const pricePerWholesale = wholesaleCost + rMargin;
        const pricePerBase = pricePerWholesale / wholesaleRate;
        const suggestedRetailPrice = Math.ceil(pricePerBase * retailRate);

        // Auto-select if cost changed > 1%
        const costRatio = oldBaseCost > 0 ? newBaseCost / oldBaseCost : 1;
        const rowKey = (p.id as number).toString();

        newRows.push({
          key: rowKey,
          product_id: p.id as number,
          product_name: p.name as string,

          old_base_cost: oldBaseCost,
          new_base_cost: newBaseCost,

          old_wholesale_cost: oldWholesaleCost,
          new_wholesale_cost: wholesaleCost,

          has_wholesale: hasWholesale,
          wholesale_unit_name:
            wholesaleUnitObj?.unit_name || retailUnitObj?.unit_name || "ĐV",
          wholesale_rate: wholesaleRate,
          current_wholesale_price:
            wholesaleUnitObj?.price_sell || wholesaleUnitObj?.price || 0,
          new_wholesale_price: suggestedWholesalePrice,

          retail_unit_name: retailUnitObj?.unit_name || "ĐV",
          retail_rate: retailRate,
          current_retail_price:
            retailUnitObj?.price_sell || retailUnitObj?.price || 0,
          new_retail_price: suggestedRetailPrice,

          retail_margin: Math.round(rMargin),
          wholesale_margin: Math.round(wMargin),
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

  // --- Helpers: sync margin <-> price ---
  const updateRow = (key: string, updates: Partial<PriceRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...updates } : r))
    );
    if (!selectedRowKeys.includes(key)) {
      setSelectedRowKeys((prev) => [...prev, key]);
    }
  };

  const handleRetailPriceChange = (record: PriceRow, val: number) => {
    const pricePerBase = val / record.retail_rate;
    const pricePerWholesale = pricePerBase * record.wholesale_rate;
    updateRow(record.key, {
      new_retail_price: val,
      retail_margin: Math.round(pricePerWholesale - record.new_wholesale_cost),
    });
  };

  const handleRetailMarginChange = (record: PriceRow, val: number) => {
    const pricePerWholesale = record.new_wholesale_cost + val;
    const pricePerBase = pricePerWholesale / record.wholesale_rate;
    updateRow(record.key, {
      retail_margin: val,
      new_retail_price: Math.ceil(pricePerBase * record.retail_rate),
    });
  };

  const handleWholesalePriceChange = (record: PriceRow, val: number) => {
    updateRow(record.key, {
      new_wholesale_price: val,
      wholesale_margin: Math.round(val - record.new_wholesale_cost),
    });
  };

  const handleWholesaleMarginChange = (record: PriceRow, val: number) => {
    updateRow(record.key, {
      wholesale_margin: val,
      new_wholesale_price: Math.ceil(record.new_wholesale_cost + val),
    });
  };

  // --- Save ---
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
        actual_cost: row.new_base_cost,
        retail_price: row.new_retail_price,
        wholesale_price: row.has_wholesale ? row.new_wholesale_price : null,
        retail_margin: row.retail_margin,
        retail_margin_type: "amount",
        wholesale_margin: row.wholesale_margin,
        wholesale_margin_type: "amount",
      }));

      await safeRpc("bulk_update_product_prices", { p_data: payload });

      message.success(
        `Thành công! Đã cập nhật giá cho ${selectedRows.length} sản phẩm.`
      );
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      message.error(`Lỗi hệ thống: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const numberFormatter = (value: number | undefined) =>
    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const numberParser = (value: string | undefined) =>
    value!.replace(/\$\s?|(,*)/g, "") as unknown as number;

  // --- COLUMNS ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 200,
      fixed: "left" as const,
      render: (text: string, r: PriceRow) => (
        <div>
          <b>{text}</b>
          <div style={{ fontSize: 12, color: "#666" }}>
            Lẻ: {r.retail_unit_name} | Buôn: {r.wholesale_unit_name}
          </div>
        </div>
      ),
    },
    {
      title: "Giá Vốn",
      width: 220,
      render: (_: unknown, r: PriceRow) => {
        const diff =
          r.old_wholesale_cost > 0
            ? ((r.new_wholesale_cost - r.old_wholesale_cost) /
                r.old_wholesale_cost) *
              100
            : 100;
        const color = diff > 0 ? "red" : "green";
        const icon = diff > 0 ? "↗" : "↘";

        return (
          <div>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>
              1 {r.wholesale_unit_name}
            </div>
            {Math.abs(diff) < 0.1 ? (
              <Tag>{formatCurrency(r.new_wholesale_cost)}</Tag>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 12 }} type="secondary">
                  {formatCurrency(r.old_wholesale_cost)}{" "}
                  <ArrowRightOutlined />{" "}
                </Text>
                <b>{formatCurrency(r.new_wholesale_cost)}</b>
                <Tag color={color} style={{ marginRight: 0 }}>
                  {icon} {Math.abs(diff).toFixed(1)}%
                </Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Giá Bán Lẻ",
      width: 170,
      render: (_: unknown, record: PriceRow) => (
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>
            {record.retail_unit_name} (Hiện:{" "}
            {formatCurrency(record.current_retail_price)})
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
            onChange={(v) => handleRetailPriceChange(record, Number(v))}
          />
        </div>
      ),
    },
    {
      title: "Lãi Lẻ",
      width: 130,
      render: (_: unknown, record: PriceRow) => (
        <InputNumber
          value={record.retail_margin}
          style={{
            width: "100%",
            color: record.retail_margin < 0 ? "#ff4d4f" : undefined,
          }}
          formatter={numberFormatter}
          parser={numberParser}
          onChange={(v) => handleRetailMarginChange(record, Number(v))}
        />
      ),
    },
    {
      title: "Giá Bán Buôn",
      width: 170,
      render: (_: unknown, record: PriceRow) => (
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
            onChange={(v) => handleWholesalePriceChange(record, Number(v))}
          />
        </div>
      ),
    },
    {
      title: "Lãi Buôn",
      width: 130,
      render: (_: unknown, record: PriceRow) => (
        <InputNumber
          value={record.wholesale_margin}
          style={{
            width: "100%",
            color: record.wholesale_margin < 0 ? "#ff4d4f" : undefined,
          }}
          formatter={numberFormatter}
          parser={numberParser}
          onChange={(v) => handleWholesaleMarginChange(record, Number(v))}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Cập nhật Giá bán lẻ & Bán buôn (Dựa trên Lợi nhuận cài đặt)"
      open={visible}
      onCancel={onClose}
      width={1300}
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
        scroll={{ x: 1200, y: 400 }}
        rowKey="key"
      />
    </Modal>
  );
};
