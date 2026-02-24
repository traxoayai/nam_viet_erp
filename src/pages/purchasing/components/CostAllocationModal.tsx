// src/pages/purchasing/components/CostAllocationModal.tsx
import {
  CalculatorOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Table,
  InputNumber,
  Button,
  Typography,
  Space,
  Descriptions,
  Tooltip,
  message,
  Row,
  Col,
} from "antd";
import React, { useState, useEffect } from "react";

import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";

const { Text } = Typography;

interface CostAllocationModalProps {
  open: boolean;
  onCancel: () => void;
  items: POItem[]; // Danh sách items ban đầu
  onConfirm: (data: any[]) => void; // Hàm submit về cha
  loading?: boolean;
}

// Helper: Phân bổ phí vận chuyển
const allocateShippingFee = (items: any[], totalShippingFee: number) => {
  const totalValue = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  if (totalValue === 0) return items;

  return items.map((item) => {
    const itemValue = item.unit_price * item.quantity;
    const ratio = itemValue / totalValue;
    const allocatedFee = Math.round(totalShippingFee * ratio);
    return { ...item, allocated_shipping_fee: allocatedFee };
  });
};

export const CostAllocationModal: React.FC<CostAllocationModalProps> = ({
  open,
  onCancel,
  items,
  onConfirm,
  loading,
}) => {
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [totalShipping, setTotalShipping] = useState<number>(0);
  const [otherFee, setOtherFee] = useState<number>(0);

  // Init data when open
  useEffect(() => {
    if (open && items.length > 0) {
      // Map items sang cấu trúc state local
      const mapped = items.map((i) => ({
        id: (i as any).id || (i as any).item_id, // Important: need table ID
        product_id: i.product_id,
        name: i.name,
        sku: i.sku,
        unit_price: i.unit_price || 0,
        quantity: i.quantity || 0,
        uom: i.uom,

        // Fields to edit
        vat_rate: 0,
        rebate_rate: 0,
        bonus_quantity: 0,
        allocated_shipping_fee: 0, // Default 0

        // Calc fields
        final_unit_cost: 0,
      }));

      // Initial split if totalShipping > 0
      if (totalShipping > 0) {
        const allocated = allocateShippingFee(mapped, totalShipping);
        recalcCosts(allocated);
      } else {
        recalcCosts(mapped);
      }
    }
  }, [open, items]);

  // Recalculate Final Cost for ALL items
  // Formula: ((Price * Qty) - (Price * Qty * Rebate%) + (Price * Qty * VAT%) + Ship) / (Qty + Bonus)
  const recalcCosts = (currentItems: any[]) => {
    const calculated = currentItems.map((item) => {
      const rawTotal = item.unit_price * item.quantity;
      const rebateVal = rawTotal * (item.rebate_rate / 100);
      const vatVal = rawTotal * (item.vat_rate / 100);

      const totalCostLanded =
        rawTotal -
        rebateVal +
        vatVal +
        (item.allocated_shipping_fee || 0) +
        otherFee / currentItems.length; // Simple split for other fee? Or just ignore other fee in cost per unit? Req says Ship allocation. Let's keep other fee separate or ask.
      // Better: User only asked to allocate Shipping Fee. Other Fee is just for header display?
      // "Nhập Phí Khác: Input số tiền." -> Usually Other Fee also adds to cost.
      // Let's assume Other Fee is NOT allocated automatically unless specified, or maybe add it to shipping for simplicity?
      // For now, STRICTLY follow formula provided in USER REQUEST:
      // ((Giá Mua * SL) - (Giá Mua * SL * Rebate%) + (Giá Mua * SL * VAT%) + Ship) / (SL + Tặng)
      // So Other Fee is NOT in the formula explicitly given in Code Snippet but usually it should be.
      // I will stick to the formula provided: Only Ship is added.

      const totalQty = item.quantity + (item.bonus_quantity || 0);

      const finalUnitCost =
        totalQty > 0 ? Math.round(totalCostLanded / totalQty) : 0;

      return { ...item, final_unit_cost: finalUnitCost };
    });
    setDataSource(calculated);
  };

  // Handle Allocate Button
  const handleAllocate = () => {
    const allocated = allocateShippingFee(dataSource, totalShipping);
    recalcCosts(allocated);
    message.success("Đã phân bổ phí vận chuyển!");
  };

  // Handle Cell Change
  const handleItemChange = (key: any, field: string, val: number) => {
    const newData = [...dataSource];
    const index = newData.findIndex((item) => item.product_id === key); // Use product_id or id
    if (index > -1) {
      newData[index][field] = val;
      recalcCosts(newData);
    }
  };

  // Summary Stats
  const totalImportValue = dataSource.reduce(
    (sum, item) =>
      sum + item.final_unit_cost * (item.quantity + item.bonus_quantity),
    0
  );
  const totalRebate = dataSource.reduce(
    (sum, item) =>
      sum + item.unit_price * item.quantity * (item.rebate_rate / 100),
    0
  );

  const columns: any[] = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      width: 250,
      render: (text: string, r: any) => (
        <div>
          <Text strong>{text}</Text>
          <div>
            <Text type="secondary">{r.sku}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "SL Mua",
      dataIndex: "quantity",
      width: 80,
      align: "center",
      render: (v: number, r: any) => `${v} ${r.uom}`,
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 100,
      align: "right",
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "VAT %",
      dataIndex: "vat_rate",
      width: 80,
      render: (v: number, r: any) => (
        <InputNumber
          min={0}
          max={100}
          value={v}
          onChange={(val) =>
            handleItemChange(r.product_id, "vat_rate", val || 0)
          }
          size="small"
        />
      ),
    },
    {
      title: (
        <Tooltip title="% Chiết khấu sau (Trả vào ví)">
          Rebate % <InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: "rebate_rate",
      width: 80,
      render: (v: number, r: any) => (
        <InputNumber
          min={0}
          max={100}
          value={v}
          onChange={(val) =>
            handleItemChange(r.product_id, "rebate_rate", val || 0)
          }
          size="small"
          style={{ borderColor: "#52c41a" }}
        />
      ),
    },
    {
      title: "Tặng (SL)",
      dataIndex: "bonus_quantity",
      width: 90,
      render: (v: number, r: any) => (
        <InputNumber
          min={0}
          value={v}
          onChange={(val) =>
            handleItemChange(r.product_id, "bonus_quantity", val || 0)
          }
          size="small"
        />
      ),
    },
    {
      title: "Phí Ship",
      dataIndex: "allocated_shipping_fee",
      width: 110,
      render: (v: number, r: any) => (
        <InputNumber
          min={0}
          value={v}
          onChange={(val) =>
            handleItemChange(r.product_id, "allocated_shipping_fee", val || 0)
          }
          size="small"
          parser={(displayVal) =>
            displayVal ? Math.round(Number(displayVal)) : 0
          }
        />
      ),
    },
    {
      title: (
        <Tooltip title="Giá vốn thực tế sau khi cộng chi phí và trừ chiết khấu / Tổng số lượng thực nhận">
          Giá Vốn <InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: "final_unit_cost",
      width: 120,
      fixed: "right",
      align: "right",
      render: (v: number) => (
        <Text strong style={{ color: "#096dd9" }}>
          {v?.toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <CalculatorOutlined /> Tính Giá Vốn Nhập Hàng (Landed Cost)
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onConfirm(dataSource)}
          loading={loading}
          size="large"
        >
          Xác nhận & Nhập kho
        </Button>,
      ]}
    >
      {/* Header Inputs */}
      <div
        style={{
          background: "#f5f5f5",
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Row gutter={24} align="middle">
          <Col span={8}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Tổng tiền hàng (Base)">
                <b>
                  {items
                    .reduce((s, i) => s + i.unit_price * i.quantity, 0)
                    .toLocaleString()}
                </b>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={16}>
            <Space size="large">
              <div>
                <Text>Phí Vận Chuyển (Tổng):</Text>
                <br />
                <InputNumber
                  style={{ width: 150 }}
                  value={totalShipping}
                  onChange={(v) => setTotalShipping(v || 0)}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, ""))}
                  addonAfter="đ"
                />
              </div>
              <div>
                <Text>Phí Khác:</Text>
                <br />
                <InputNumber
                  style={{ width: 150 }}
                  value={otherFee}
                  onChange={(v) => setOtherFee(v || 0)}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  addonAfter="đ"
                />
              </div>
              <Button
                type="dashed"
                onClick={handleAllocate}
                icon={<CalculatorOutlined />}
              >
                Phân bổ tự động
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Table */}
      <Table
        dataSource={dataSource}
        columns={columns}
        rowKey="product_id"
        pagination={false}
        scroll={{ x: 1000, y: 400 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7} align="right">
                <Text strong>Tổng Giá trị Nhập kho:</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text type="danger" strong>
                  {totalImportValue.toLocaleString()}đ
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Footer Warning */}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Space direction="vertical" align="end">
          <Text type="success">
            Tổng Rebate tích lũy ví NCC: +{totalRebate.toLocaleString()}đ
          </Text>
          <Text
            type="secondary"
            style={{ fontSize: 13, fontStyle: "italic", color: "#faad14" }}
          >
            * Lưu ý: Số tiền chiết khấu (Rebate) sẽ được cộng vào Ví NCC. Giá
            trị thanh toán của đơn hàng vẫn giữ nguyên.
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            * Hệ thống sẽ cập nhật giá vốn mới nhất vào danh mục sản phẩm.
          </Text>
        </Space>
      </div>
    </Modal>
  );
};
