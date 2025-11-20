// src/stores/useLoyaltyStore.ts
import { create } from "zustand";

import { supabase } from "@/lib/supabaseClient";
import { LoyaltyPolicy, DEFAULT_LOYALTY_POLICY } from "@/types/loyalty";

interface LoyaltyStoreState {
  policy: LoyaltyPolicy;
  loading: boolean;

  fetchPolicy: () => Promise<void>;
  savePolicy: (policy: LoyaltyPolicy) => Promise<boolean>;
}

const SETTING_KEY = "loyalty_policy";

export const useLoyaltyStore = create<LoyaltyStoreState>((set) => ({
  policy: DEFAULT_LOYALTY_POLICY,
  loading: false,

  fetchPolicy: async () => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .single();

      if (data && data.value) {
        set({ policy: data.value as LoyaltyPolicy });
      } else {
        // Chưa có thì dùng mặc định
        set({ policy: DEFAULT_LOYALTY_POLICY });
      }
    } catch (error) {
      console.error("Lỗi tải chính sách tích điểm:", error);
    } finally {
      set({ loading: false });
    }
  },

  savePolicy: async (newPolicy: LoyaltyPolicy) => {
    set({ loading: true });
    try {
      const { error } = await supabase.from("system_settings").upsert({
        key: SETTING_KEY,
        value: newPolicy,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      set({ policy: newPolicy });
      return true;
    } catch (error) {
      console.error("Lỗi lưu chính sách:", error);
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
