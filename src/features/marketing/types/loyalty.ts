// src/types/loyalty.ts

export interface RedeemTier {
  pointsNeeded: number;
  voucherType: "fixed" | "percent";
  voucherValue: number;
  voucherMinPurchase: number;
  voucherExpiryDays: number;
}

export interface LoyaltyPolicy {
  // Tích điểm
  earnRateAmount: number; // Bao nhiêu tiền...
  earnRatePoints: number; // ...được bao nhiêu điểm
  applyTo: string[]; // ['pos', 'b2b', 'clinic']
  earnOnDiscounted: boolean; // Có tích điểm cho hàng giảm giá không
  pointExpiryType: "never" | "duration";
  pointExpiryMonths?: number;

  // Đổi điểm
  redeemTiers: RedeemTier[];
}

// Giá trị mặc định nếu chưa có cấu hình
export const DEFAULT_LOYALTY_POLICY: LoyaltyPolicy = {
  earnRateAmount: 100000,
  earnRatePoints: 10,
  applyTo: ["pos"],
  earnOnDiscounted: false,
  pointExpiryType: "never",
  redeemTiers: [
    {
      pointsNeeded: 1000,
      voucherType: "fixed",
      voucherValue: 50000,
      voucherMinPurchase: 200000,
      voucherExpiryDays: 30,
    },
  ],
};
