// TanStack Query hooks cho Gap 1 Chatbot P2.5.
// Pattern theo useInboxSessions (Plan 2 Task 5): invalidate queryKey gắn productId
// để tránh refetch toàn bộ synonyms khi đổi SP.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addProductSynonym,
  bulkImportSynonyms,
  deleteProductSynonym,
  listProductSynonyms,
  searchProductsForSynonym,
  type BulkImportResult,
  type BulkImportRow,
  type ProductSearchResult,
  type ProductSynonym,
} from "../api/synonymApi";

export function useProductSynonyms(productId: number | null) {
  return useQuery<ProductSynonym[]>({
    queryKey: ["chatbot", "synonyms", productId],
    queryFn: () =>
      productId ? listProductSynonyms(productId) : Promise.resolve([]),
    enabled: !!productId,
    staleTime: 10_000,
  });
}

export function useSynonymProductSearch(query: string) {
  return useQuery<ProductSearchResult[]>({
    queryKey: ["chatbot", "synonym-product-search", query],
    queryFn: () =>
      query.length >= 2 ? searchProductsForSynonym(query) : Promise.resolve([]),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useAddSynonym() {
  const qc = useQueryClient();
  return useMutation<
    number,
    Error,
    { productId: number; synonym: string; weight?: number }
  >({
    mutationFn: (params) =>
      addProductSynonym(params.productId, params.synonym, params.weight),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ["chatbot", "synonyms", vars.productId],
      });
      void qc.invalidateQueries({
        queryKey: ["chatbot", "synonym-product-search"],
      });
    },
  });
}

export function useDeleteSynonym(productId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id: number) => deleteProductSynonym(id),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["chatbot", "synonyms", productId],
      });
      void qc.invalidateQueries({
        queryKey: ["chatbot", "synonym-product-search"],
      });
    },
  });
}

export function useBulkImportSynonyms() {
  const qc = useQueryClient();
  return useMutation<BulkImportResult, Error, BulkImportRow[]>({
    mutationFn: (rows) => bulkImportSynonyms(rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chatbot", "synonyms"] });
      void qc.invalidateQueries({
        queryKey: ["chatbot", "synonym-product-search"],
      });
    },
  });
}
