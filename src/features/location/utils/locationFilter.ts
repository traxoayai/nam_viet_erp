// src/features/location/utils/locationFilter.ts
import { normalizeString } from "@/shared/utils/stringMatching";

// Lọc option Select không phân biệt dấu/hoa-thường tiếng Việt
// (vd gõ "ha noi" khớp "Thành phố Hà Nội"). Input rỗng -> hiện tất cả.
export function filterLocationOption(input: string, label?: string): boolean {
  const keyword = normalizeString(input);
  if (!keyword) return true;
  return normalizeString(label ?? "").includes(keyword);
}
