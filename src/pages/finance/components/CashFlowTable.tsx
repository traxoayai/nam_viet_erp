// src/pages/finance/components/CashFlowTable.tsx
// Báo cáo Lưu chuyển tiền tệ — vào / ra / lưu chuyển thuần
import { Descriptions, Empty, Typography } from "antd";

import type { CashFlow } from "@/features/finance/api/financialReportsService";

import { fmtMoney } from "@/shared/utils/money";

const { Text } = Typography;

interface Props {
  data: CashFlow | null;
  fetched: boolean;
}

const moneyStyle = { fontVariantNumeric: "tabular-nums" as const };

export const CashFlowTable: React.FC<Props> = ({ data, fetched }) => {
  if (!fetched || !data) {
    return <Empty description="Chọn kỳ và nhấn Xem báo cáo" />;
  }

  return (
    <Descriptions bordered column={1} size="middle">
      <Descriptions.Item label="Dòng tiền vào">
        <Text style={moneyStyle}>{fmtMoney(data.dong_tien_vao)}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="Dòng tiền ra">
        <Text style={moneyStyle}>{fmtMoney(data.dong_tien_ra)}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="Lưu chuyển tiền thuần">
        <Text strong style={moneyStyle}>
          {fmtMoney(data.luu_chuyen_thuan)}
        </Text>
      </Descriptions.Item>
    </Descriptions>
  );
};
