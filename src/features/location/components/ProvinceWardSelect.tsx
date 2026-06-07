// src/features/location/components/ProvinceWardSelect.tsx
// Bộ chọn địa chỉ 2 cấp Tỉnh/Thành -> Phường/Xã (mô hình hành chính 2025).
// CONTROLLED: nhận value {provinceCode, wardCode}, phát onChange. Đổi tỉnh tự reset xã.
// Đọc dữ liệu từ bảng provinces/wards (đã seed). Dùng cho form địa chỉ structured khi
// nghiệp vụ chuyển từ địa chỉ free-text sang mã hành chính (chờ PM chốt mới wire vào form).
import { Select, Space } from "antd";
import { useMemo } from "react";

import { useProvinces, useWardsByProvince } from "../hooks/useLocationData";
import { filterLocationOption } from "../utils/locationFilter";

export interface ProvinceWardValue {
  provinceCode: string | null;
  wardCode: string | null;
}

interface ProvinceWardSelectProps {
  value?: ProvinceWardValue;
  onChange?: (value: ProvinceWardValue) => void;
  disabled?: boolean;
  provincePlaceholder?: string;
  wardPlaceholder?: string;
}

export function ProvinceWardSelect({
  value,
  onChange,
  disabled = false,
  provincePlaceholder = "Chọn Tỉnh/Thành phố",
  wardPlaceholder = "Chọn Phường/Xã",
}: ProvinceWardSelectProps) {
  const provinceCode = value?.provinceCode ?? null;
  const wardCode = value?.wardCode ?? null;

  const { data: provinces = [], isLoading: loadingProvinces } = useProvinces();
  const { data: wards = [], isLoading: loadingWards } =
    useWardsByProvince(provinceCode);

  const provinceOptions = useMemo(
    () =>
      provinces.map((p) => ({ value: p.code, label: p.full_name || p.name })),
    [provinces]
  );
  const wardOptions = useMemo(
    () => wards.map((w) => ({ value: w.code, label: w.full_name || w.name })),
    [wards]
  );

  return (
    <Space.Compact block>
      <Select
        style={{ width: "50%" }}
        showSearch
        allowClear
        disabled={disabled}
        loading={loadingProvinces}
        placeholder={provincePlaceholder}
        value={provinceCode || undefined}
        options={provinceOptions}
        filterOption={(input, option) =>
          filterLocationOption(input, String(option?.label ?? ""))
        }
        onChange={(code?: string) =>
          // Đổi tỉnh -> reset phường/xã (mã xã cũ không còn hợp lệ).
          onChange?.({ provinceCode: code ?? null, wardCode: null })
        }
      />
      <Select
        style={{ width: "50%" }}
        showSearch
        allowClear
        disabled={disabled || !provinceCode}
        loading={loadingWards}
        placeholder={wardPlaceholder}
        value={wardCode || undefined}
        options={wardOptions}
        filterOption={(input, option) =>
          filterLocationOption(input, String(option?.label ?? ""))
        }
        onChange={(code?: string) =>
          onChange?.({ provinceCode, wardCode: code ?? null })
        }
      />
    </Space.Compact>
  );
}

export default ProvinceWardSelect;
