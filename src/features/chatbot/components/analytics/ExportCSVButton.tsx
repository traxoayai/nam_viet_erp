// Button export CSV generic (Plan 2 Task 14.3).
// - Dùng `toCSV` + `downloadCSV` từ utils/csv.
// - Generic theo type T để caller chỉ cần truyền rows + columns.

import { DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";

import { downloadCSV, toCSV } from "../../utils/csv";

export interface ExportCSVButtonProps<T extends Record<string, unknown>> {
  filename: string;
  rows: T[];
  columns: Array<{ key: keyof T; label: string }>;
}

export function ExportCSVButton<T extends Record<string, unknown>>({
  filename,
  rows,
  columns,
}: ExportCSVButtonProps<T>) {
  return (
    <Button
      icon={<DownloadOutlined />}
      onClick={() => downloadCSV(filename, toCSV(rows, columns))}
    >
      Export CSV
    </Button>
  );
}
