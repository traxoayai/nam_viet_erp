// src/pages/purchasing/components/PurchaseCostingSection.tsx
import {
  CalculatorOutlined,
  GiftOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  Card,
  Typography,
  Row,
  Col,
  InputNumber,
  Button,
  Table,
  Space,
  Tag,
  Select,
  Input,
} from "antd";
import { useEffect } from "react";

import {
  usePurchaseCostingLogic,
  CostingItem,
  GiftItem,
} from "../hooks/usePurchaseCostingLogic";

import { UpdatePriceModal } from "./UpdatePriceModal";

import { formatCurrency } from "@/shared/utils/format";

const { Text } = Typography;

export interface CostingData {
  costingTotal: number;
  handleSubmit: () => void;
  loading: boolean;
}

interface PurchaseCostingSectionProps {
  poId: number | string;
  poItems: any[];
  shippingFee: number;
  supplierId?: number;
  onComplete?: () => void;
  onCostingDataChange?: (data: CostingData) => void;
}

const PurchaseCostingSection: React.FC<PurchaseCostingSectionProps> = ({
  poId,
  poItems,
  shippingFee,
  supplierId,
  onComplete,
  onCostingDataChange,
}) => {
  const logic = usePurchaseCostingLogic({
    poId,
    poItems,
    shippingFee,
    supplierId,
    onComplete,
  });

  const costingTotal = logic.costingItems.reduce(
    (sum, item) => sum + item.final_unit_cost * (item.quantity_ordered + item.bonus_quantity),
    0
  );

  useEffect(() => {
    onCostingDataChange?.({
      costingTotal,
      handleSubmit: logic.handleSubmit,
      loading: logic.loading,
    });
  }, [costingTotal, logic.handleSubmit, logic.loading]);

  // --- COLUMNS ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 250,
      fixed: "left" as const,
      render: (text: string, r: CostingItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {r.sku} ({r.unit})
          </div>
        </div>
      ),
    },
    {
      title: "SL Mua",
      dataIndex: "quantity_ordered",
      width: 80,
      align: "center" as const,
      render: (val: number) => <b>{val}</b>,
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      width: 120,
      align: "right" as const,
      render: (val: number) => formatCurrency(val),
    },
    {
      title: "Rebate %",
      width: 100,
      render: (_: any, r: CostingItem) => (
        <InputNumber
          min={0}
          max={100}
          value={r.rebate_rate}
          onChange={(v) =>
            logic.handleItemChange(r.id, "rebate_rate", Number(v))
          }
        />
      ),
    },
    {
      title: "VAT %",
      width: 100,
      render: (_: any, r: CostingItem) => (
        <InputNumber
          min={0}
          max={100}
          value={r.vat_rate}
          onChange={(v) => logic.handleItemChange(r.id, "vat_rate", Number(v))}
        />
      ),
    },
    {
      title: "SL Tặng (Bonus)",
      width: 110,
      render: (_: any, r: CostingItem) => (
        <InputNumber
          min={0}
          value={r.bonus_quantity}
          status={r.bonus_quantity > 0 ? "warning" : ""}
          onChange={(v) =>
            logic.handleItemChange(r.id, "bonus_quantity", Number(v))
          }
        />
      ),
    },
    {
      title: "Phí Ship PB",
      width: 130,
      render: (_: any, r: CostingItem) => (
        <InputNumber
          style={{ width: "100%" }}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
          parser={(value) =>
            value!.replace(/\$\s?|(,*)/g, "") as unknown as number
          }
          value={r.allocated_shipping}
          onChange={(v) =>
            logic.handleItemChange(r.id, "allocated_shipping", Number(v))
          }
        />
      ),
    },
    {
      title: "GIÁ VỐN (FINAL)",
      width: 150,
      fixed: "right" as const,
      align: "right" as const,
      render: (_: any, r: CostingItem) => (
        <Tag color="green" style={{ fontSize: 14, padding: "4px 8px" }}>
          {formatCurrency(r.final_unit_cost)}
        </Tag>
      ),
    },
  ];

  const giftColumns = [
    {
      title: "Tên Quà Tặng",
      render: (_: any, r: GiftItem) => (
        <Input
          value={r.name}
          onChange={(e) => logic.updateGift(r.key, "name", e.target.value)}
          placeholder="Nhập tên quà..."
        />
      ),
    },
    {
      title: "Mã quản lý",
      width: 150,
      render: (_: any, r: GiftItem) => (
        <Input
          value={r.code}
          onChange={(e) => logic.updateGift(r.key, "code", e.target.value)}
          placeholder="GIFT-XXX"
        />
      ),
    },
    {
      title: "SL",
      width: 100,
      render: (_: any, r: GiftItem) => (
        <InputNumber
          min={1}
          value={r.quantity}
          onChange={(v) => logic.updateGift(r.key, "quantity", v)}
        />
      ),
    },
    {
      title: "ĐVT",
      width: 100,
      render: (_: any, r: GiftItem) => (
        <Input
          value={r.unit_name}
          onChange={(e) => logic.updateGift(r.key, "unit_name", e.target.value)}
        />
      ),
    },
    {
      title: "Giá trị (Ước tính)",
      width: 150,
      render: (_: any, r: GiftItem) => (
        <InputNumber
          style={{ width: "100%" }}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
          parser={(value) =>
            value!.replace(/\$\s?|(,*)/g, "") as unknown as number
          }
          value={r.estimated_value}
          onChange={(v) => logic.updateGift(r.key, "estimated_value", v)}
        />
      ),
    },
    {
      width: 50,
      render: (_: any, r: GiftItem) => (
        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => logic.removeGift(r.key)}
        />
      ),
    },
  ];

  return (
    <div>
      {/* BLOCK A: CONFIG */}
      <Card
        title={
          <Space>
            <CalculatorOutlined /> Cấu hình Chi Phí
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={24} align="bottom">
          <Col span={8}>
            <Text strong>Chọn Chương trình / Hợp đồng</Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Chọn chương trình khuyến mãi (Optional)"
              value={logic.selectedProgram}
              onChange={logic.handleProgramChange}
              options={logic.programOptions}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Text strong>Tổng Phí Nhập Hàng (Vận chuyển/Khác)</Text>
            <InputNumber
              style={{ width: "100%", marginTop: 8 }}
              size="large"
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                value!.replace(/\$\s?|(,*)/g, "") as unknown as number
              }
              value={logic.totalShippingFee}
              onChange={(val) => logic.setTotalShippingFee(Number(val))}
              addonAfter="₫"
            />
          </Col>
          <Col span={8}>
            <Button
              type="primary"
              onClick={logic.handleAllocateShipping}
              style={{ width: "40%" }}
              size="large"
            >
              Phân bổ Phí (Theo Giá trị)
            </Button>
          </Col>
        </Row>
      </Card>

      {/* BLOCK B: MAIN TABLE */}
      <Card
        title="Chi tiết Giá Vốn Sản Phẩm"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={logic.costingItems}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1200 }}
          loading={logic.loading}
        />
      </Card>

      {/* BLOCK C: GIFTS */}
      <Card
        title={
          <Space>
            <GiftOutlined /> Quà Tặng Kèm Theo (Ngoài danh mục)
          </Space>
        }
        style={{ marginBottom: 80 }}
        extra={
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={logic.addGiftRow}
          >
            Thêm quà
          </Button>
        }
      >
        <Table
          dataSource={logic.giftItems}
          columns={giftColumns}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: "Chưa có quà tặng nào" }}
        />
      </Card>


      <UpdatePriceModal
        visible={logic.showPriceModal}
        onClose={logic.handlePriceModalClose}
        costingItems={logic.costingItems}
        oldCosts={logic.preUpdateCosts}
      />
    </div>
  );
};

export default PurchaseCostingSection;
