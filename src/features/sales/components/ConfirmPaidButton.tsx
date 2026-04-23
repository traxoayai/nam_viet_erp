import { CheckCircleOutlined } from "@ant-design/icons";
import { Button, message, Modal } from "antd";

import { paymentService } from "@/features/sales/api/paymentService";
import { COLORS } from "@/shared/constants/colors";
import { formatVnd } from "@/shared/utils/format";

interface ConfirmPaidOrder {
  id: string;
  code: string;
  status?: string;
  payment_status?: string;
  final_amount?: number;
  paid_amount?: number;
}

interface Props {
  order: ConfirmPaidOrder;
  onSuccess: () => void;
  /** Custom label, default "Đã nhận đủ tiền" */
  label?: string;
  /** Force render bất kể order.status — dùng khi caller tự check điều kiện */
  force?: boolean;
  style?: React.CSSProperties;
  size?: "small" | "middle" | "large";
}

const GREEN_STYLE: React.CSSProperties = {
  backgroundColor: COLORS.actionSuccess,
  borderColor: COLORS.actionSuccess,
};

/**
 * Nút 1-click xác nhận NV đã nhận đủ tiền cho đơn.
 * Gọi RPC record_manual_payment_received → trigger auto_allocate fire →
 * orders.paid_amount/status update → notify trigger fire → KH + NV nhận noti.
 *
 * Render chỉ khi order PENDING + còn outstanding (trừ khi `force`).
 */
export function ConfirmPaidButton({
  order,
  onSuccess,
  label = "Đã nhận đủ tiền",
  force,
  style,
  size,
}: Props) {
  const outstanding = Math.max(
    0,
    (order.final_amount ?? 0) - (order.paid_amount ?? 0),
  );
  const canConfirm =
    force ||
    (order.status === "PENDING" &&
      order.payment_status !== "paid" &&
      outstanding > 0);

  if (!canConfirm) return null;

  const handleClick = () => {
    Modal.confirm({
      title: `Xác nhận đã nhận tiền đơn ${order.code}`,
      content: `Ghi nhận đã nhận ${formatVnd(outstanding)} đ cho đơn ${order.code}? Đơn sẽ tự chuyển CONFIRMED.`,
      okText: "Đã nhận",
      cancelText: "Hủy",
      okButtonProps: { style: GREEN_STYLE },
      onOk: async () => {
        try {
          message.loading({ content: "Đang ghi nhận...", key: "manualPay" });
          const res = await paymentService.recordManualPayment(order.id);
          message.success({
            content: `Đã ghi nhận ${formatVnd(res.amount)} đ cho đơn ${res.order_code}`,
            key: "manualPay",
          });
          onSuccess();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          message.error({ content: "Lỗi: " + msg, key: "manualPay" });
        }
      },
    });
  };

  return (
    <Button
      type="primary"
      size={size}
      icon={<CheckCircleOutlined />}
      onClick={handleClick}
      style={{ ...GREEN_STYLE, ...style }}
    >
      {label}
    </Button>
  );
}
