// Sales Inbox right panel: hiển thị thông tin khách + công nợ + 5 đơn gần nhất.
// Plan 2 Task 8.

import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, List, Tag, Empty, Spin, Typography } from "antd";

import {
  getChatCustomerSummary,
  type ChatCustomerSummary,
} from "../../api/customerSummaryApi";

const { Text } = Typography;
const VND = new Intl.NumberFormat("vi-VN");

export interface InboxCustomerPanelProps {
  userId: string | null;
}

export function InboxCustomerPanel({ userId }: InboxCustomerPanelProps) {
  const { data, isLoading } = useQuery<ChatCustomerSummary | null>({
    queryKey: ["chatbot", "customer-summary", userId],
    queryFn: () =>
      userId ? getChatCustomerSummary(userId) : Promise.resolve(null),
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!userId) return null;
  if (isLoading) return <Spin style={{ width: "100%", margin: 32 }} />;
  if (!data?.portal_user) {
    return (
      <div
        style={{
          width: 320,
          padding: 16,
          borderLeft: "1px solid #f0f0f0",
        }}
      >
        <Empty
          description="Khách chưa đăng ký Portal"
          style={{ marginTop: 48 }}
        />
      </div>
    );
  }

  const debtTotal = data.debt?.debt_total ?? 0;
  const debtUnavailable = data.debt?.note === "unavailable";

  return (
    <div
      style={{
        width: 320,
        padding: 16,
        borderLeft: "1px solid #f0f0f0",
        overflowY: "auto",
      }}
    >
      <Card size="small" title="Khách hàng" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Tên">
            {data.portal_user.display_name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="SĐT">
            {data.portal_user.phone ?? "—"}
          </Descriptions.Item>
          {data.customer ? (
            <>
              <Descriptions.Item label="Đơn vị">
                {data.customer.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="MST">
                {data.customer.tax_code ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">
                {data.customer.vat_address ??
                  data.customer.shipping_address ??
                  "—"}
              </Descriptions.Item>
            </>
          ) : null}
        </Descriptions>
      </Card>

      <Card size="small" title="Công nợ" style={{ marginBottom: 12 }}>
        {debtUnavailable ? (
          <Text type="secondary">Không lấy được công nợ</Text>
        ) : (
          <>
            <div>
              Tổng: <Text strong>{VND.format(debtTotal)} đ</Text>
            </div>
            {data.debt?.available_credit !== undefined && (
              <div style={{ marginTop: 4 }}>
                Hạn mức còn:{" "}
                <Text>{VND.format(data.debt.available_credit)} đ</Text>
              </div>
            )}
            {data.debt?.pending_orders_total ? (
              <div style={{ marginTop: 4 }}>
                Đơn chờ:{" "}
                <Text type="warning">
                  {VND.format(data.debt.pending_orders_total)} đ
                </Text>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card size="small" title="5 đơn gần nhất">
        <List
          dataSource={data.recent_orders ?? []}
          locale={{ emptyText: "Chưa có đơn" }}
          renderItem={(o) => (
            <List.Item style={{ padding: "6px 0" }}>
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <a
                    href={`/sales/b2b/${o.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {o.code}
                  </a>
                  <Tag>{o.status}</Tag>
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {VND.format(o.total)} đ
                </div>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
