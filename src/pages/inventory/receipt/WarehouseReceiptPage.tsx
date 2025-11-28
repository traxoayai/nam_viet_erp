// src/pages/inventory/receipt/WarehouseReceiptPage.tsx
import {
  SaveOutlined,
  AudioOutlined,
  CameraOutlined,
  PlusOutlined,
  DeleteOutlined,
  BarcodeOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Table,
  Button,
  Input,
  DatePicker,
  InputNumber,
  Typography,
  Space,
  Tag,
  Alert,
  Upload,
  Grid,
  Row,
  Col,
  Avatar,
  Tooltip,
} from "antd";
//import React from "react";
import { useNavigate } from "react-router-dom";

import {
  useWarehouseReceiptLogic,
  ReceiptItem,
} from "./hooks/useWarehouseReceiptLogic";

const { Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const WarehouseReceiptPage = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();

  // Gọi Hook logic
  const {
    poData,
    items,
    setItems,
    loading,
    activeUserCount,
    isBulkScanLoading,
    isViewMode,
    receiptCode,
    scanning,
    isListening,
    handleUpdateItem,
    handleSplitLine,
    handleVoiceRow,
    handleScanRow,
    handleBulkScan,
    handleSubmit,
  } = useWarehouseReceiptLogic();

  // --- RENDER MOBILE ITEM (CARD) ---
  const renderMobileItem = (item: ReceiptItem) => (
    <Card
      key={item.key}
      size="small"
      style={{ marginBottom: 12, border: "1px solid #d9d9d9" }}
      styles={{ body: { padding: 12 } }}
    >
      {/* Header: Ảnh + Tên */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Avatar
          shape="square"
          size={64}
          src={item.image_url}
          icon={<BarcodeOutlined />}
        />
        <div style={{ flex: 1 }}>
          <Text
            strong
            style={{ fontSize: 16, display: "block", lineHeight: 1.2 }}
          >
            {item.product_name}
          </Text>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <Tag>{item.sku}</Tag>
            <Text type="secondary">{item.uom}</Text>
          </div>
        </div>
      </div>

      <Row gutter={8} style={{ marginBottom: 12 }} align="middle">
        <Col span={8}>
          <Text type="secondary">Thực nhận:</Text>
        </Col>
        <Col span={16}>
          <InputNumber
            size="large"
            style={{ width: "100%" }}
            min={0}
            value={item.quantity_received}
            onChange={(v) => handleUpdateItem(item.key, "quantity_received", v)}
            disabled={isViewMode}
            addonBefore={
              !isViewMode ? (
                <Text type="secondary">/{item.quantity_ordered}</Text>
              ) : null
            }
          />
        </Col>
      </Row>

      {item.stock_management_type === "lot_date" && (
        <div style={{ background: "#f5f5f5", padding: 8, borderRadius: 6 }}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Input
                prefix={
                  <Text strong style={{ fontSize: 12, width: 30 }}>
                    Lô
                  </Text>
                }
                placeholder="Nhập số lô..."
                value={item.lot_number}
                onChange={(e) =>
                  handleUpdateItem(item.key, "lot_number", e.target.value)
                }
                disabled={isViewMode}
                suffix={
                  !isViewMode && (
                    <Tooltip title="Voice Input">
                      <AudioOutlined
                        style={{
                          color: isListening ? "red" : "#1890ff",
                          fontSize: 18,
                        }}
                        onClick={() => handleVoiceRow(item.key)}
                      />
                    </Tooltip>
                  )
                }
              />
            </Col>
            <Col span={24}>
              <div style={{ display: "flex", gap: 8 }}>
                <DatePicker
                  placeholder="Hạn dùng"
                  style={{ flex: 1 }}
                  format="DD/MM/YYYY"
                  value={item.expiry_date}
                  onChange={(d) => handleUpdateItem(item.key, "expiry_date", d)}
                  disabled={isViewMode}
                />
                {!isViewMode && (
                  <Button
                    icon={
                      scanning ? (
                        <span className="ant-spin-dot"></span>
                      ) : (
                        <CameraOutlined />
                      )
                    }
                    type="primary"
                    ghost
                    onClick={() =>
                      document.getElementById(`cam_m_${item.key}`)?.click()
                    }
                  />
                )}
                <input
                  type="file"
                  id={`cam_m_${item.key}`}
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      handleScanRow(item.key, e.target.files[0]);
                  }}
                />
              </div>
            </Col>
          </Row>
          {item.evidence_url ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#52c41a" }}>
              <CheckCircleOutlined /> Đã lưu ảnh vỏ hộp
            </div>
          ) : null}
        </div>
      )}

      {!isViewMode && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Button icon={<PlusOutlined />} onClick={() => handleSplitLine(item)}>
            Tách dòng
          </Button>
          {item.key.includes("_") && !item.key.endsWith("_1") && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                setItems((prev) => prev.filter((i) => i.key !== item.key))
              }
            />
          )}
        </div>
      )}
    </Card>
  );

  // --- RENDER DESKTOP TABLE ---
  const columns = [
    {
      title: "Sản phẩm",
      width: 300,
      fixed: "left" as const,
      render: (_: any, r: ReceiptItem) => (
        <Space align="start">
          <Avatar
            shape="square"
            size={48}
            src={r.image_url}
            icon={<BarcodeOutlined />}
          />
          <div>
            <Text strong>{r.product_name}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.sku}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    { title: "ĐVT", dataIndex: "uom", width: 80, align: "center" as const },
    {
      title: "SL Đặt",
      dataIndex: "quantity_ordered",
      width: 80,
      align: "center" as const,
      render: (v: number) =>
        isViewMode ? "--" : <Text type="secondary">{v}</Text>,
    },
    {
      title: "Thực nhận",
      width: 120,
      render: (_: any, r: any) =>
        isViewMode ? (
          <b>{r.quantity_received}</b>
        ) : (
          <InputNumber
            value={r.quantity_received}
            min={0}
            onChange={(v) => handleUpdateItem(r.key, "quantity_received", v)}
          />
        ),
    },
    {
      title: (
        <Space>
          Lô/Hạn <Text type="danger">*</Text>
        </Space>
      ),
      width: 350,
      render: (_: any, r: any) => {
        if (r.stock_management_type !== "lot_date") return "--";
        if (isViewMode)
          return `${r.lot_number} - ${r.expiry_date?.format("DD/MM/YY")}`;
        return (
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="Lô"
              value={r.lot_number}
              onChange={(e) =>
                handleUpdateItem(r.key, "lot_number", e.target.value)
              }
              suffix={
                <AudioOutlined
                  onClick={() => handleVoiceRow(r.key)}
                  style={{ color: "#1890ff", cursor: "pointer" }}
                />
              }
            />
            <DatePicker
              placeholder="Hạn"
              value={r.expiry_date}
              format="DD/MM/YY"
              onChange={(d) => handleUpdateItem(r.key, "expiry_date", d)}
              style={{ width: 130 }}
            />
            <Tooltip title="Chụp vỏ hộp">
              <Button
                icon={<CameraOutlined />}
                onClick={() =>
                  document.getElementById(`cam_d_${r.key}`)?.click()
                }
              />
            </Tooltip>
            <input
              type="file"
              id={`cam_d_${r.key}`}
              hidden
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                if (e.target.files?.[0])
                  handleScanRow(r.key, e.target.files[0]);
              }}
            />
          </Space.Compact>
        );
      },
    },
    {
      width: 50,
      fixed: "right" as const,
      render: (_: any, r: any) =>
        !isViewMode && (
          <Space>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleSplitLine(r)}
            />
            {r.key.includes("_") && !r.key.endsWith("_1") && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  setItems((prev) => prev.filter((i) => i.key !== r.key))
                }
              />
            )}
          </Space>
        ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{
          width: "100%",
          padding: screens.md ? 24 : 12,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/inventory/inbound")}
          />
          <Title level={5} style={{ margin: 0, flex: 1, textAlign: "center" }}>
            {isViewMode
              ? `PHIẾU NHẬP: ${receiptCode}`
              : `NHẬP KHO ĐƠN: ${poData?.code}`}
          </Title>
          {!isViewMode && (
            <Upload beforeUpload={handleBulkScan} showUploadList={false}>
              <Button
                icon={
                  isBulkScanLoading ? (
                    <span className="ant-spin-dot"></span>
                  ) : (
                    <CloudUploadOutlined />
                  )
                }
              />
            </Upload>
          )}
        </div>

        {activeUserCount > 1 && (
          <Alert
            message="Có người khác đang thao tác!"
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        <Card
          styles={{ body: { padding: 0 } }}
          bordered={false}
          style={{ background: "transparent", boxShadow: "none" }}
        >
          {screens.md ? (
            <Table
              dataSource={items}
              columns={columns}
              pagination={false}
              rowKey="key"
              scroll={{ x: 800 }}
              style={{ background: "#fff", borderRadius: 8 }}
            />
          ) : (
            <div>{items.map((item) => renderMobileItem(item))}</div>
          )}
        </Card>

        {/* Footer Action */}
        {!isViewMode && (
          <>
            <div style={{ height: 80 }} />
            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                padding: 12,
                background: "#fff",
                borderTop: "1px solid #f0f0f0",
                zIndex: 99,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <Text style={{ fontSize: 12 }} type="secondary">
                <BarcodeOutlined /> Quét mã: Sẵn sàng
              </Text>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={loading}
                style={{ minWidth: 150 }}
              >
                HOÀN TẤT
              </Button>
            </div>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default WarehouseReceiptPage;
