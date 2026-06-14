/**
 * Invoice Extraction Hook
 * Upload PDF/image → RPC extracts supplier name + items → return form structure
 */
import { useState, useCallback } from "react";

import type {
  InvoiceLineItem,
  InvoiceFormData,
} from "@/features/finance/types/invoiceTypes";

import { safeRpc } from "@/shared/lib/safeRpc";

interface UseInvoiceExtractionReturn {
  loading: boolean;
  error?: string;
  extractedData?: Partial<InvoiceFormData>;
  uploadAndExtract: (
    file: File,
    productLookup: Record<string, number>
  ) => Promise<Partial<InvoiceFormData> | null>;
  reset: () => void;
}

export function useInvoiceExtraction(): UseInvoiceExtractionReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [extractedData, setExtractedData] = useState<
    Partial<InvoiceFormData> | undefined
  >();

  const uploadAndExtract = useCallback(
    async (
      file: File,
      productLookup: Record<string, number>
    ): Promise<Partial<InvoiceFormData> | null> => {
      setLoading(true);
      setError(undefined);

      try {
        // Convert file to base64 for RPC transmission
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Call RPC to extract invoice (safeRpc throws on error)
        const { data } = await safeRpc<
          unknown,
          { file_data: string; product_lookup: Record<string, number> },
          unknown
        >(
          "extract_invoice_from_pdf",
          {
            file_data: fileBase64,
            product_lookup: productLookup,
          },
          { silent: true } // Don't show toast, handle error here
        );

        // Map extracted data to form structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = data as any;

        const mappedData: Partial<InvoiceFormData> = {
          customer_name: rawData?.supplier_name || "",
          invoice_number: rawData?.invoice_number || "",
          items: (rawData?.items || []).map(
            (item: { sku: string; quantity: number; unit_price: number }) => ({
              key: `extracted-${item.sku}-${Date.now()}`,
              product_id: productLookup[item.sku] || undefined,
              product_name: item.sku,
              quantity: item.quantity,
              unit_price: item.unit_price,
              vat_rate: 10 as const, // Default VAT
              discount_amount: 0,
            })
          ) as InvoiceLineItem[],
        };

        setExtractedData(mappedData);
        setLoading(false);
        return mappedData;
      } catch (err) {
        const errorMessage = `Failed to extract invoice: ${err instanceof Error ? err.message : "Unknown error"}`;
        setError(errorMessage);
        setExtractedData(undefined);
        setLoading(false);
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(undefined);
    setExtractedData(undefined);
  }, []);

  return {
    loading,
    error,
    extractedData,
    uploadAndExtract,
    reset,
  };
}
