// src/pages/inventory/cost-adjustment/CostAdjustmentPage.tsx
// Màn "Điều chỉnh Giá Vốn" — sửa batches.inbound_price theo từng lô.
// Hạch toán: lưu reason_code (data_fix | supplier_adjust | nrv_writedown) + audit batch_revaluations.

import {
  DollarOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  SaveOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import {
  BatchValuationRow,
  CostAdjustmentReason,
  RevaluationHistoryRow,
  costAdjustmentService,
} from "@/features/inventory/api/costAdjustmentService";
import { useCostAdjustmentStore } from "@/features/inventory/stores/useCostAdjustmentStore";
import { useWarehouseStore } from "@/features/inventory/stores/warehouseStore";
import { useDebounce } from "@/shared/hooks/useDebounce";

const { Title, Text } = Typography;

const REASON_OPTIONS: {
  value: CostAdjustmentReason;
  label: string;
  desc: string;
}[] = [
  {
    value: "data_fix",
    label: "Sửa sai dữ liệu nhập",
    desc: "Giá nhập ban đầu sai (gõ nhầm, thiếu số 0, gán nhầm lô...)",
  },
  {
    value: "supplier_adjust",
    label: "NCC điều chỉnh giá hồi tố",
    desc: "NCC ra credit note giảm giá, hoặc yêu cầu bù thêm tiền cho hàng đã nhập",
  },
  {
    value: "nrv_writedown",
    label: "Giảm giá trị thuần (hàng cận date / hỏng)",
    desc: "Khuyến nghị lập dự phòng TK 2294 thay vì sửa trực tiếp giá gốc",
  },
];

const formatMoney = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(n || 0));

const CostAdjustmentPage: React.FC = () => {
  const { warehouses, fetchWarehouses } = useWarehouseStore();
  const {
    warehouseId,
    onlyMissingPrice,
    rows,
    totalCount,
    loading,
    page,
    pageSize,
    stats,
    statsLoading,
    pendingChanges,
    setWarehouse,
    setSearch,
    setOnlyMissingPrice,
    setPage,
    fetchGrid,
    fetchStats,
    setPendingPrice,
    clearPending,
    getDirtyChanges,
    getDirtyDelta,
    applyChanges,
  } = useCostAdjustmentStore();

  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebounce(localSearch, 400);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState<CostAdjustmentReason>("data_fix");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<RevaluationHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<{
    batchId?: number;
    productId?: number;
  }>({});

  useEffect(() => {
    void fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    void fetchGrid();
    void fetchStats();
  }, [fetchGrid, fetchStats]);

  useEffect(() => {
    setSearch(debouncedSearch);
    void fetchGrid();
  }, [debouncedSearch, setSearch, fetchGrid]);

  const dirtyCount = pendingChanges.size;
  const dirtyDelta = useMemo(() => getDirtyDelta(), [pendingChanges, rows]);
  const dirtyChanges = useMemo(
    () => getDirtyChanges(),
    [pendingChanges, rows]
  );

  const openHistory = async (filter: typeof historyFilter) => {
    setHistoryFilter(filter);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await costAdjustmentService.getHistory({
        ...filter,
        limit: 50,
      });
      setHistory(data);
    } catch (err) {
      console.error(err);
      message.error("Không tải được lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ok = await applyChanges(reason, note.trim() || undefined);
      if (ok) {
        setConfirmOpen(false);
        setNote("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "Sản phẩm",
      key: "product",
      width: 280,
      fixed: "left" as const,
      render: (_: any, r: BatchValuationRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.product_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            SKU: {r.sku || "—"}
          </Text>
        </div>
      ),
    },
    {
      title: "Lô",
      dataIndex: "lot_number",
      key: "lot_number",
      width: 140,
      render: (v: string, r: BatchValuationRow) => (
        <div>
          <Tag color="blue">{v}</Tag>
          <div style={{ fontSize: 12, color: "#888" }}>
            HSD: {r.expiry_date}
          </div>
        </div>
      ),
    },
    {
      title: "Kho",
      dataIndex: "warehouse_name",
      key: "warehouse_name",
      width: 140,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Tồn",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      align: "right" as const,
      render: (v: number) => formatMoney(v),
    },
    {
      title: "Giá vốn hiện tại",
      dataIndex: "inbound_price",
      key: "inbound_price",
      width: 140,
      align: "right" as const,
      render: (v: number) => (
        <span
          style={{
            color: v === 0 ? "#ff4d4f" : undefined,
            fontWeight: v === 0 ? 600 : undefined,
          }}
        >
          {formatMoney(v)} ₫
          {v === 0 && (
            <Tooltip title="Lô chưa có giá nhập">
              <WarningOutlined style={{ marginLeft: 6 }} />
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: "Giá vốn mới",
      key: "new_price",
      width: 180,
      render: (_: any, r: BatchValuationRow) => {
        const pending = pendingChanges.get(r.batch_id);
        const value = pending ?? r.inbound_price;
        const dirty =
          pending !== undefined &&
          Math.abs(pending - r.inbound_price) >= 0.0001;
        return (
          <InputNumber
            style={{
              width: "100%",
              borderColor: dirty ? "#faad14" : undefined,
            }}
            min={0}
            step={1000}
            value={value}
            formatter={(v) =>
              `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            }
            parser={(v) =>
              (v?.replace(/[^\d]/g, "") || "0") as unknown as number
            }
            onChange={(val) =>
              setPendingPrice(r.batch_id, val == null ? null : Number(val))
            }
          />
        );
      },
    },
    {
      title: "Chênh lệch",
      key: "delta",
      width: 130,
      align: "right" as const,
      render: (_: any, r: BatchValuationRow) => {
        const pending = pendingChanges.get(r.batch_id);
        if (pending === undefined) return "—";
        const delta = r.quantity * (pending - r.inbound_price);
        if (!delta) return "—";
        return (
          <Text type={delta > 0 ? "success" : "danger"}>
            {delta > 0 ? "+" : ""}
            {formatMoney(delta)} ₫
          </Text>
        );
      },
    },
    {
      title: "Giá trị (mới)",
      key: "new_value",
      width: 140,
      align: "right" as const,
      render: (_: any, r: BatchValuationRow) => {
        const pending = pendingChanges.get(r.batch_id);
        const price = pending ?? r.inbound_price;
        return (
          <strong>{formatMoney(r.quantity * price)} ₫</strong>
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 60,
      render: (_: any, r: BatchValuationRow) => (
        <Tooltip title="Xem lịch sử định giá của lô này">
          <Button
            type="text"
            icon={<HistoryOutlined />}
            onClick={() => openHistory({ batchId: r.batch_id })}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <DollarOutlined /> Điều chỉnh Giá Vốn theo Lô
          </Title>
          <Text type="secondary">
            Sửa giá vốn (<code>batches.inbound_price</code>) — ghi audit
            trail và đồng bộ sổ cái tồn kho VAT. Không ảnh hưởng báo cáo
            COGS/đơn hàng đã xuất.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => openHistory({})}
            >
              Lịch sử
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void fetchGrid();
                void fetchStats();
              }}
            >
              Tải lại
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card loading={statsLoading}>
            <Statistic
              title="Tổng giá trị tồn (theo lô)"
              value={stats.total_value}
              precision={0}
              suffix="₫"
              valueStyle={{ color: "#1677ff" }}
              formatter={(v) => formatMoney(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={statsLoading}>
            <Statistic
              title="Số lô còn tồn"
              value={stats.count_batches}
              suffix={
                stats.count_zero_price_batches > 0 ? (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    {stats.count_zero_price_batches} lô chưa có giá
                  </Tag>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Thay đổi chưa lưu"
              value={dirtyCount}
              suffix="lô"
              valueStyle={{ color: dirtyCount > 0 ? "#faad14" : undefined }}
            />
            {dirtyCount > 0 && (
              <Text type={dirtyDelta >= 0 ? "success" : "danger"}>
                Δ tổng: {dirtyDelta > 0 ? "+" : ""}
                {formatMoney(dirtyDelta)} ₫
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col flex="240px">
            <Select
              allowClear
              style={{ width: "100%" }}
              placeholder="Chọn kho (tất cả)"
              value={warehouseId ?? undefined}
              onChange={(v) => setWarehouse(v ?? null)}
              options={warehouses.map((w: any) => ({
                value: w.id,
                label: w.name,
              }))}
            />
          </Col>
          <Col flex="auto">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm SKU, tên sản phẩm, số lô..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </Col>
          <Col>
            <Space>
              <Switch
                checked={onlyMissingPrice}
                onChange={setOnlyMissingPrice}
              />
              <Text>Chỉ lô thiếu giá</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="Giá vốn của giao dịch đã xuất được đông lạnh trong inventory_transactions.unit_price — thay đổi ở đây chỉ áp dụng cho xuất kho tương lai và báo cáo 'tổng giá trị tồn hiện tại'."
      />

      <Table
        size="middle"
        rowKey="inventory_batch_id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 1280 }}
        pagination={{
          current: page,
          pageSize,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: ["20", "50", "100", "200"],
          onChange: (p, ps) => setPage(p, ps),
          showTotal: (t) => `Tổng ${t} dòng`,
        }}
      />

      {dirtyCount > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: 12,
            padding: 12,
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space size="large">
            <Text strong>{dirtyCount} lô đang sửa</Text>
            <Text type={dirtyDelta >= 0 ? "success" : "danger"}>
              Δ tổng: {dirtyDelta > 0 ? "+" : ""}
              {formatMoney(dirtyDelta)} ₫
            </Text>
          </Space>
          <Space>
            <Button onClick={clearPending}>Hủy thay đổi</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => setConfirmOpen(true)}
            >
              Lưu thay đổi
            </Button>
          </Space>
        </div>
      )}

      <Modal
        title="Xác nhận điều chỉnh giá vốn"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleSubmit}
        okText="Xác nhận & Lưu"
        cancelText="Đóng"
        confirmLoading={submitting}
        width={560}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Giá mới sẽ áp dụng cho mọi kho đang có lô này. Thao tác được ghi vết để audit."
        />

        <div style={{ marginBottom: 12 }}>
          <Text strong>
            {dirtyChanges.length} lô sẽ được cập nhật — Δ tổng:{" "}
          </Text>
          <Text type={dirtyDelta >= 0 ? "success" : "danger"}>
            {dirtyDelta > 0 ? "+" : ""}
            {formatMoney(dirtyDelta)} ₫
          </Text>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text strong>Lý do điều chỉnh *</Text>
        </div>
        <Radio.Group
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: "100%" }}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            {REASON_OPTIONS.map((o) => (
              <Radio key={o.value} value={o.value}>
                <div>
                  <div>{o.label}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {o.desc}
                  </Text>
                </div>
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        {reason === "nrv_writedown" && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="Khuyến nghị lập dự phòng giảm giá HTK qua TK 2294 (Nợ 632 / Có 2294) thay vì sửa trực tiếp giá nhập gốc. Hãy xác nhận với kế toán."
          />
        )}

        <div style={{ marginTop: 16, marginBottom: 4 }}>
          <Text strong>Ghi chú</Text>
        </div>
        <Input.TextArea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="VD: Đối chiếu HĐ NCC 12345 ngày 10/04 — nhập sai giá từ 22.000 thành 2.200"
        />
      </Modal>

      <Drawer
        title="Lịch sử định giá"
        placement="right"
        width={640}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        extra={
          historyFilter.batchId || historyFilter.productId ? (
            <Button size="small" onClick={() => openHistory({})}>
              Xem tất cả
            </Button>
          ) : null
        }
      >
        <Table
          size="small"
          rowKey="id"
          loading={historyLoading}
          dataSource={history}
          pagination={false}
          columns={[
            {
              title: "Thời gian",
              dataIndex: "created_at",
              width: 150,
              render: (v: string) => new Date(v).toLocaleString("vi-VN"),
            },
            {
              title: "Sản phẩm / Lô",
              key: "pl",
              render: (_: any, r: RevaluationHistoryRow) => (
                <div>
                  <div>{r.product?.name || `#${r.product_id}`}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Lô: {r.batch?.batch_code || r.batch_id}
                  </Text>
                </div>
              ),
            },
            {
              title: "Cũ → Mới",
              key: "change",
              render: (_: any, r: RevaluationHistoryRow) => (
                <span>
                  {formatMoney(r.old_price)} →{" "}
                  <strong>{formatMoney(r.new_price)}</strong>
                </span>
              ),
            },
            {
              title: "Δ",
              dataIndex: "delta_value",
              align: "right" as const,
              render: (v: number) => (
                <Text type={v >= 0 ? "success" : "danger"}>
                  {v > 0 ? "+" : ""}
                  {formatMoney(v)} ₫
                </Text>
              ),
            },
            {
              title: "Lý do",
              dataIndex: "reason_code",
              render: (v: CostAdjustmentReason) => {
                const map: Record<CostAdjustmentReason, { color: string; label: string }> = {
                  data_fix: { color: "blue", label: "Sửa sai" },
                  supplier_adjust: { color: "purple", label: "NCC hồi tố" },
                  nrv_writedown: { color: "red", label: "NRV" },
                };
                const cfg = map[v];
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
              },
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default CostAdjustmentPage;
