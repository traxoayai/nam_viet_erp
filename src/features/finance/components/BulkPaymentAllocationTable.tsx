import { Table, Tag, Typography, Space, InputNumber, Alert } from "antd";
import dayjs from "dayjs";
import React, { useMemo } from "react";

import { AllocatedOrder } from "../hooks/useBulkPaymentAllocation";

import { formatVnd } from "@/shared/utils/format";

const { Text } = Typography;

interface Props {
  loading: boolean;
  dataSource: AllocatedOrder[];
  selectedRowKeys: React.Key[];
  onRowSelectionChange: (keys: React.Key[]) => void;
  totalReceived: number;
  totalAllocated: number;
  remainingToAdvance: number;
  onTotalReceivedChange: (amount: number) => void;
}

export const BulkPaymentAllocationTable: React.FC<Props> = ({
  loading,
  dataSource,
  selectedRowKeys,
  onRowSelectionChange,
  totalReceived,
  totalAllocated,
  remainingToAdvance,
  onTotalReceivedChange,
}) => {
  // Columns
  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "code",
        key: "code",
        width: 120,
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: "Ngày tạo",
        dataIndex: "created_at",
        key: "created_at",
        width: 120,
        render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
      },
      {
        title: "Tổng tiền",
        dataIndex: "final_amount",
        key: "final_amount",
        align: "right" as const,
        width: 120,
        render: (val: number) => formatVnd(val ?? 0) + "đ",
      },
      {
        title: "Đã trả",
        dataIndex: "paid_amount",
        key: "paid_amount",
        align: "right" as const,
        width: 120,
        render: (val: number) => formatVnd(val ?? 0) + "đ",
      },
      {
        title: "Cần thu",
        dataIndex: "need_to_collect",
        key: "need_to_collect",
        align: "right" as const,
        width: 120,
        render: (val: number) => (
          <Text strong type="danger">
            {formatVnd(val ?? 0) + "đ"}
          </Text>
        ),
      },
      {
        title: "Đã phân bổ",
        dataIndex: "allocated_amount",
        key: "allocated_amount",
        align: "right" as const,
        width: 150,
        render: (val: number) => (
          <Text strong style={{ color: "#1890ff" }}>
            {formatVnd(val ?? 0) + "đ"}
          </Text>
        ),
      },
      {
        title: "Trạng thái",
        key: "status",
        width: 150,
        align: "center" as const,
        render: (_: unknown, record: AllocatedOrder) => {
          if (!selectedRowKeys.includes(record.id)) {
            return <Text type="secondary">Bỏ qua</Text>;
          }
          if (record.status_after === "paid")
            return <Tag color="success">Trả đủ</Tag>;
          if (record.status_after === "partial")
            return <Tag color="warning">1 phần</Tag>;
          return <Text type="secondary">Chưa</Text>;
        },
      },
    ],
    [selectedRowKeys]
  );

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #d9d9d9",
        padding: 12,
        borderRadius: 8,
        background: "#fcfcfc",
      }}
    >
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Phân Bổ Gạch Nợ Hàng Loạt (B2B)
      </Typography.Title>

      <Space align="start" style={{ marginBottom: 16 }}>
        <div>
          <Text strong>Tổng tiền khách đưa (đ): </Text>
          <InputNumber
            style={{ width: 200, fontWeight: "bold", color: "#1890ff" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => Number(v!.replace(/\$\s?|(,*)/g, ""))}
            min={0}
            size="large"
            value={totalReceived}
            onChange={(val) => onTotalReceivedChange(val || 0)}
            placeholder="Nhập số tiền..."
          />
        </div>
      </Space>

      <Alert
        message={
          <Space split={<Text type="secondary">|</Text>}>
            <Text>
              Tổng khách đưa:{" "}
              <strong style={{ color: "#1890ff" }}>
                {formatVnd(totalReceived)} đ
              </strong>
            </Text>
            <Text>
              Đã gạch nợ:{" "}
              <strong style={{ color: "#52c41a" }}>
                {formatVnd(totalAllocated)} đ
              </strong>
            </Text>
            <Text>
              Tiền thừa (Nộp rải/Tạm ứng):{" "}
              <strong style={{ color: "#faad14" }}>
                {formatVnd(remainingToAdvance)} đ
              </strong>
            </Text>
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        size="small"
        bordered
        loading={loading}
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: onRowSelectionChange,
          getCheckboxProps: (record) => ({
            // Nếu muốn vô hiệu hóa checkbox với đơn đã thanh toán xong từ trước:
            disabled: record.need_to_collect <= 0,
          }),
        }}
        scroll={{ y: 300 }}
      />
    </div>
  );
};
