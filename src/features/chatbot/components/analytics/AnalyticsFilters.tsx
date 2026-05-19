// Bộ lọc dashboard analytics chatbot (Plan 2 Task 12.1).
// - RangePicker có preset 7/30 ngày.
// - Select platform: web / zalo / fb (cleared = tất cả).

import { DatePicker, Select, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";

export interface AnalyticsFiltersValue {
  range: [Dayjs, Dayjs];
  platform?: "web" | "zalo" | "fb";
}

export interface AnalyticsFiltersProps {
  value: AnalyticsFiltersValue;
  onChange: (v: AnalyticsFiltersValue) => void;
}

export function AnalyticsFilters({ value, onChange }: AnalyticsFiltersProps) {
  return (
    <Space style={{ marginBottom: 16 }}>
      <DatePicker.RangePicker
        value={value.range}
        onChange={(r) =>
          r && r[0] && r[1] && onChange({ ...value, range: [r[0], r[1]] })
        }
        presets={[
          { label: "7 ngày", value: [dayjs().subtract(7, "day"), dayjs()] },
          { label: "30 ngày", value: [dayjs().subtract(30, "day"), dayjs()] },
        ]}
      />
      <Select
        placeholder="Tất cả nền tảng"
        allowClear
        value={value.platform}
        onChange={(p) => onChange({ ...value, platform: p })}
        options={[
          { value: "web", label: "Web" },
          { value: "zalo", label: "Zalo" },
          { value: "fb", label: "Facebook" },
        ]}
        style={{ width: 160 }}
      />
    </Space>
  );
}
