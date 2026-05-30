import { supabase } from "@/shared/lib/supabaseClient";
import { PurchaseOrderV2 } from "../types";

export const purchaseOrderV2Service = {
  async getList(searchTerm?: string): Promise<PurchaseOrderV2[]> {
    const { data, error } = await supabase.functions.invoke("search-purchase-orders", {
      body: { searchTerm: searchTerm || "" }
    });

    if (error) throw error;
    // Edge function returns { data: [...] }
    return data?.data as PurchaseOrderV2[] || [];
  },

  async updateStatus(id: number, status: string): Promise<void> {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  async delete(id: number, hardDelete: boolean = false): Promise<void> {
    if (hardDelete) {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "CANCELLED" })
        .eq("id", id);
      if (error) throw error;
    }
  },
};
