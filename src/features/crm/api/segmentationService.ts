import {
  CreateSegmentPayload,
  SegmentMemberDisplay,
  CustomerSegmentRow,
} from "../types/segments"; // <-- Import từ segments.ts

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
      .insert([payload])
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
      .update(payload)
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

    return data.map((item: any) => ({
      id: item.customers?.id,
      name: item.customers?.name || "Unknown",
      phone: item.customers?.phone,
      gender: item.customers?.gender,
      loyalty_points: item.customers?.loyalty_points,
      added_at: item.added_at,
    }));
  },

  async refreshSegment(segmentId: number) {
    const { error } = await supabase.rpc("refresh_segment_members", {
      p_segment_id: segmentId,
    });
    if (error) throw error;
  },
};
