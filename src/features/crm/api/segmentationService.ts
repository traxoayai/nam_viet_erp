import {
  CreateSegmentPayload,
  SegmentMemberDisplay,
  CustomerSegmentRow,
} from "../types/segments"; // <-- Import từ segments.ts

import type { Json } from "@/shared/lib/database.types";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export const segmentationService = {
  async getSegments() {
    const { data, error } = await supabase
      .from("customer_segments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as CustomerSegmentRow[];
  },

  async createSegment(payload: CreateSegmentPayload) {
    const { data, error } = await supabase
      .from("customer_segments")
      .insert([{ ...payload, criteria: payload.criteria as unknown as Json }])
      .select()
      .single();
    if (error) throw error;

    if (data.type === "dynamic") {
      await this.refreshSegment(data.id);
    }
    return data;
  },

  async updateSegment(id: number, payload: Partial<CreateSegmentPayload>) {
    const { error } = await supabase
      .from("customer_segments")
      .update({ ...payload, criteria: payload.criteria as unknown as Json })
      .eq("id", id);
    if (error) throw error;
  },

  async deleteSegment(id: number) {
    const { error } = await supabase
      .from("customer_segments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getSegmentMembers(segmentId: number): Promise<SegmentMemberDisplay[]> {
    const { data, error } = await supabase
      .from("customer_segment_members")
      .select(
        `
        added_at,
        customers ( id, name, phone, dob, gender, loyalty_points )
      `
      )
      .eq("segment_id", segmentId);

    if (error) throw error;

    return data.map((item: Record<string, unknown>) => {
      const cust = item.customers as Record<string, unknown> | undefined;
      return {
        id: (cust?.id as number) || 0,
        name: (cust?.name as string) || "Unknown",
        phone: (cust?.phone as string) || null,
        gender: (cust?.gender as string) || null,
        loyalty_points: (cust?.loyalty_points as number) || null,
        added_at: item.added_at as string,
      };
    });
  },

  async refreshSegment(segmentId: number) {
    await safeRpc("refresh_segment_members", {
      p_segment_id: segmentId,
    });
  },
};
