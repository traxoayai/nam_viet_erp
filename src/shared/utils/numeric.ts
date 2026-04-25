// src/shared/utils/numeric.ts
// Safe numeric parsing — tránh NaN/Infinity khi nhận giá trị từ API.

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseNumericOrZero(value: unknown): number {
  return parseNumeric(value) ?? 0;
}
