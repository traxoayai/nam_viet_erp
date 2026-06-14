// API wrappers cho Gap 1 Chatbot P2.5 — Marketing quản lý product_synonyms.
// Mọi RPC PHẢI qua safeRpc (rule supabase-rpc.md).
// Types khai báo thủ công vì lib/database.types.ts không tự update — cùng pattern
// inbox/compliance.

import type { Json } from "@/shared/lib/database.types";
import { safeRpc } from "@/shared/lib/safeRpc";

export interface ProductSynonym {
  id: number;
  synonym: string;
  weight: number;
  created_at: string;
}

export interface ProductSearchResult {
  id: number;
  name: string;
  sku: string;
  active_ingredient: string | null;
  synonym_count: number;
}

export interface BulkImportRow {
  sku: string;
  synonym: string;
  weight?: number;
}

export interface BulkImportError {
  sku?: string;
  synonym?: string;
  reason: string;
}

export interface BulkImportResult {
  inserted: number;
  skipped: number;
  errors: BulkImportError[];
}

export async function listProductSynonyms(
  productId: number
): Promise<ProductSynonym[]> {
  const { data, error } = await safeRpc("list_product_synonyms", {
    p_product_id: productId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ProductSynonym[];
}

export async function addProductSynonym(
  productId: number,
  synonym: string,
  weight?: number
): Promise<number> {
  const { data, error } = await safeRpc("add_product_synonym", {
    p_product_id: productId,
    p_synonym: synonym,
    p_weight: weight ?? 1.0,
  });
  if (error) throw error;
  return data as unknown as number;
}

export async function deleteProductSynonym(id: number): Promise<void> {
  const { error } = await safeRpc("delete_product_synonym", { p_id: id });
  if (error) throw error;
}

export async function searchProductsForSynonym(
  query: string,
  limit = 20
): Promise<ProductSearchResult[]> {
  const { data, error } = await safeRpc("search_products_for_synonym_admin", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as ProductSearchResult[];
}

export async function bulkImportSynonyms(
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  const { data, error } = await safeRpc("bulk_import_synonyms", {
    p_rows: rows as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as BulkImportResult;
}
