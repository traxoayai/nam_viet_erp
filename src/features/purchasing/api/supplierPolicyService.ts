// src/features/purchasing/api/supplierPolicyService.ts
import { PolicyFormValues } from "../types/supplierPolicy";

import { supabase } from "@/shared/lib/supabaseClient";

export const supplierPolicyService = {
  // LIST
  getPolicies: async (filters: any) => {
    let query = supabase
      .from("supplier_programs")
      .select(
        `
        *,
        supplier: suppliers(id, name)
      `
      )
      .order("created_at", { ascending: false });

    if (filters.supplier_id) {
      query = query.eq("supplier_id", filters.supplier_id);
    }
    if (filters.type) {
      query = query.eq("type", filters.type);
    }
    // Date filter can be added if needed

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // DETAIL (DEEP FETCH)
  getPolicyDetail: async (programId: number) => {
    const { data, error } = await supabase
      .from("supplier_programs")
      .select(
        `
        *,
        groups: supplier_program_groups (
          *,
          scope: supplier_program_products (
            product_id,
            product: products ( id, name, sku, retail_unit, wholesale_unit )
          )
        )
      `
      )
      .eq("id", programId)
      .single();

    if (error) throw error;
    return data;
  },

  // DATA MAPPING HELPER (DB -> FORM)
  mapToFormState: (data: any): PolicyFormValues => {
    return {
      supplier_id: data.supplier_id,
      name: data.name,
      document_code: data.code,
      type: data.type,
      range_picker: [null, null], // Let UI handle conversion to Dayjs
      description: data.description,
      attachment_url: data.attachment_url,
      groups: (data.groups || []).map((g: any) => ({
        key: String(g.id), // Use ID as key
        id: g.id,
        name: g.name,
        rule_type: g.rule_type,
        price_basis: g.price_basis,
        rules: g.rules,
        product_ids: g.scope.map((s: any) => s.product_id),
        _product_display: g.scope.map((s: any) => s.product),
      })),
    };
  },

  // CREATE
  createPolicy: async (values: PolicyFormValues) => {
    const payload = {
      p_program_data: {
        supplier_id: values.supplier_id,
        code: values.document_code,
        name: values.name,
        type: values.type,
        valid_from: values.range_picker[0].format("YYYY-MM-DD"),
        valid_to: values.range_picker[1].format("YYYY-MM-DD"),
        description: values.description,
        attachment_url: values.attachment_url,
      },
      p_groups_data: values.groups.map((g) => ({
        name: g.name,
        rule_type: g.rule_type,
        price_basis: g.price_basis,
        rules: g.rules,
        product_ids: g.product_ids,
      })),
    };

    const { data, error } = await supabase.rpc(
      "create_full_supplier_program",
      payload
    );
    if (error) throw error;
    return data;
  },

  // UPDATE
  updatePolicy: async (id: number, values: PolicyFormValues) => {
    const payload = {
      p_program_id: id,
      p_program_data: {
        supplier_id: values.supplier_id,
        code: values.document_code,
        name: values.name,
        type: values.type,
        valid_from: values.range_picker[0].format("YYYY-MM-DD"),
        valid_to: values.range_picker[1].format("YYYY-MM-DD"),
        description: values.description,
        attachment_url: values.attachment_url,
      },
      p_groups_data: values.groups.map((g) => ({
        name: g.name,
        rule_type: g.rule_type,
        price_basis: g.price_basis,
        rules: g.rules,
        product_ids: g.product_ids,
      })),
    };

    const { data, error } = await supabase.rpc(
      "update_full_supplier_program",
      payload
    );
    if (error) throw error;
    return data;
  },
};
