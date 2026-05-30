// CSV utility cho export analytics (Plan 2 Task 14.1).
// - toCSV: serialize rows + columns, quote ký tự đặc biệt (`,`, `"`, `\n`).
// - downloadCSV: tạo Blob có BOM (UTF-8) để Excel hiển thị tiếng Việt đúng,
//   tự revoke ObjectURL sau khi click.

export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>
): string {
  if (rows.length === 0) return "";
  const header = columns.map((c) => quote(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => quote(String(r[c.key] ?? ""))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCSV(filename: string, csv: string): void {
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function quote(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
