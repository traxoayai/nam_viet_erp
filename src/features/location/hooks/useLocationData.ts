// src/features/location/hooks/useLocationData.ts
import { useQuery } from "@tanstack/react-query";

import { locationService } from "../api/locationService";

// Danh mục hành chính gần như tĩnh -> cache 1 giờ, không refetch khi focus.
const LOCATION_STALE_TIME = 1000 * 60 * 60;

export function useProvinces() {
  return useQuery({
    queryKey: ["location", "provinces"],
    queryFn: () => locationService.getProvinces(),
    staleTime: LOCATION_STALE_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useWardsByProvince(provinceCode: string | null | undefined) {
  return useQuery({
    queryKey: ["location", "wards", provinceCode ?? ""],
    queryFn: () => locationService.getWardsByProvince(provinceCode ?? ""),
    staleTime: LOCATION_STALE_TIME,
    refetchOnWindowFocus: false,
    // Chỉ fetch xã khi đã chọn tỉnh.
    enabled: !!provinceCode,
  });
}
