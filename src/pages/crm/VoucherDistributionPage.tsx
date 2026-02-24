// src/pages/crm/VoucherDistributionPage.tsx
//import React from "react";
import {
  GiftOutlined,
  UsergroupAddOutlined,
  SendOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Card,
  Select,
  Button,
  Typography,
  Row,
  Col,
  Divider,
  Alert,
  Table,
  Tag,
  Space,
} from "antd";

import { useVoucherDistribution } from "../../features/crm/hooks/useVoucherDistribution";

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const VoucherDistributionPage = () => {
  const {
    promotions,
    segments,
    selectedPromoId,
    setSelectedPromoId,
    selectedSegmentId,
    setSelectedSegmentId,
    loadingData,
    distributing,
    history,
    handleDistribute,
  } = useVoucherDistribution();

  // Tìm object đã chọn để hiển thị review
  const selectedPromo = promotions.find((p) => p.id === selectedPromoId);
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Content
        style={{ padding: 12, maxWidth: 1800, margin: "0 auto", width: "100%" }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2}>
            <GiftOutlined /> Phân Phối Voucher
          </Title>
          <Text type="secondary">
            Gửi tặng mã giảm giá hàng loạt đến các nhóm khách hàng mục tiêu
          </Text>
        </div>

        <Row gutter={24}>
          {/* CỘT TRÁI: BỘ ĐIỀU KHIỂN */}
          <Col span={14}>
            <Card title="Cấu hình gửi tặng" bordered={false}>
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  1. Chọn chương trình khuyến mãi (Active)
                </Text>
                <Select
                  style={{ width: "100%" }}
                  placeholder="Chọn Voucher..."
                  loading={loadingData}
                  onChange={setSelectedPromoId}
                  value={selectedPromoId}
                  size="large"
                >
                  {promotions.map((p) => (
                    <Option key={p.id} value={p.id}>
                      <Space>
                        <Tag color="green">{p.code}</Tag>
                        {p.name} (Giảm {p.discount_value?.toLocaleString()})
                      </Space>
                    </Option>
                  ))}
                </Select>
                {selectedPromo ? (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="info"
                    showIcon
                    message={`Voucher này còn lại: ${selectedPromo.total_usage_limit ? selectedPromo.total_usage_limit - selectedPromo.usage_count : "Vô hạn"} lượt sử dụng.`}
                  />
                ) : null}
              </div>

              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  2. Chọn nhóm khách hàng nhận (Segment)
                </Text>
                <Select
                  style={{ width: "100%" }}
                  placeholder="Chọn Phân khúc khách hàng..."
                  loading={loadingData}
                  onChange={setSelectedSegmentId}
                  value={selectedSegmentId}
                  size="large"
                >
                  {segments.map((s) => (
                    <Option key={s.id} value={s.id}>
                      <UsergroupAddOutlined /> {s.name} (
                      {s.type === "dynamic" ? "Tự động" : "Thủ công"})
                    </Option>
                  ))}
                </Select>
              </div>

              <Divider />

              {selectedPromo && selectedSegment ? (
                <div
                  style={{
                    background: "#f6ffed",
                    padding: 16,
                    border: "1px solid #b7eb8f",
                    borderRadius: 8,
                    marginBottom: 24,
                  }}
                >
                  <Title level={5} type="success">
                    Xác nhận gửi:
                  </Title>
                  <ul>
                    <li>
                      Gửi Voucher: <strong>{selectedPromo.name}</strong> (
                      {selectedPromo.code})
                    </li>
                    <li>
                      Đến nhóm: <strong>{selectedSegment.name}</strong>
                    </li>
                    <li>
                      Hành động: Hệ thống sẽ kiểm tra và thêm voucher vào ví của
                      tất cả thành viên trong nhóm này (nếu họ chưa có).
                    </li>
                  </ul>
                </div>
              ) : (
                <div
                  style={{
                    height: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ccc",
                    border: "1px dashed #d9d9d9",
                    borderRadius: 8,
                    marginBottom: 24,
                  }}
                >
                  Vui lòng chọn đủ thông tin
                </div>
              )}

              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                block
                disabled={!selectedPromo || !selectedSegment}
                loading={distributing}
                onClick={handleDistribute}
              >
                TIẾN HÀNH PHÂN PHỐI NGAY
              </Button>
            </Card>
          </Col>

          {/* CỘT PHẢI: LỊCH SỬ PHÂN PHỐI */}
          <Col span={10}>
            <Card
              title={
                <Space>
                  <HistoryOutlined /> Lịch sử phân phối (Voucher này)
                </Space>
              }
              style={{ height: "100%" }}
              bodyStyle={{ padding: 0 }}
            >
              {selectedPromoId ? (
                <Table
                  dataSource={history}
                  rowKey="distributed_at"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: "Đã gửi đến nhóm", dataIndex: "target_name" },
                    {
                      title: "Thời gian",
                      dataIndex: "distributed_at",
                      render: (d) => new Date(d).toLocaleString("vi-VN"),
                    },
                  ]}
                  locale={{
                    emptyText: "Voucher này chưa từng được gửi cho nhóm nào",
                  }}
                />
              ) : (
                <div
                  style={{ padding: 24, textAlign: "center", color: "#999" }}
                >
                  Chọn một Voucher bên trái để xem lịch sử gửi tặng.
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default VoucherDistributionPage;
