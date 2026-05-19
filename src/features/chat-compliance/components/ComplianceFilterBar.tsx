// Filter bar: quick range (7d / 30d / custom) + severity select.
// - Quick range buttons set from/to luôn theo "hôm nay back N ngày".
// - Severity select: All / high / medium / low (đúng giá trị PG CHECK).

import { Button, DatePicker, Select, Space, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import type { ComplianceSeverity } from "../types";

const { RangePicker } = DatePicker;
const { Text } = Typography;

export interface ComplianceFilterValue {
  from: string; // YYYY-MM-DD
  to: string;
  severity: ComplianceSeverity | null;
}

export interface ComplianceFilterBarProps {
  value: ComplianceFilterValue;
  onChange: (next: ComplianceFilterValue) => void;
}

function toIso(d: Dayjs): string {
  return d.format("YYYY-MM-DD");
}

function applyDays(days: number): { from: string; to: string } {
  const to = dayjs();
  const from = to.subtract(days - 1, "day");
  return { from: toIso(from), to: toIso(to) };
}

export function ComplianceFilterBar({
  value,
  onChange,
}: ComplianceFilterBarProps) {
  return (
    <Space wrap style={{ marginBottom: 12 }} size="middle">
      <Space size="small">
        <Text type="secondary">Khoảng:</Text>
        <Button
          size="small"
          onClick={() => onChange({ ...value, ...applyDays(7) })}
        >
          7 ngày
        </Button>
        <Button
          size="small"
          onClick={() => onChange({ ...value, ...applyDays(30) })}
        >
          30 ngày
        </Button>
      </Space>

      <RangePicker
        value={[dayjs(value.from), dayjs(value.to)]}
        allowClear={false}
        onChange={(range) => {
          if (!range || !range[0] || !range[1]) return;
          onChange({
            ...value,
            from: toIso(range[0]),
            to: toIso(range[1]),
          });
        }}
      />

      <Space size="small">
        <Text type="secondary">Severity:</Text>
        <Select<ComplianceSeverity | "all">
          value={value.severity ?? "all"}
          style={{ width: 140 }}
          onChange={(v) => {
            onChange({
              ...value,
              severity: v === "all" ? null : (v as ComplianceSeverity),
            });
          }}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "high", label: "Nghiêm trọng" },
            { value: "medium", label: "Trung bình" },
            { value: "low", label: "Thấp" },
          ]}
        />
      </Space>
    </Space>
  );
}
