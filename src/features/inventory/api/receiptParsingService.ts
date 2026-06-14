// src/features/inventory/api/receiptParsingService.ts
import { safeRpc } from "@/shared/lib/safeRpc";

/**
 * Receipt Parsing Types
 */
export interface ParsedReceiptData {
  supplier_name?: string;
  receipt_date?: string; // ISO date
  receipt_number?: string;
  items: ParsedReceiptItem[];
  total_amount?: number;
  confidence_score: number; // 0-100
  raw_text?: string;
  errors?: string[];
}

export interface ParsedReceiptItem {
  product_name: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  sku?: string;
  confidence: number; // 0-100
}

export interface AnalyzeReceiptInvoiceRequest {
  p_image_base64: string; // Base64-encoded image
  p_image_mime_type: string; // "image/png" | "image/jpeg"
}

export interface AnalyzeReceiptInvoiceResponse {
  success: boolean;
  data?: ParsedReceiptData;
  error?: string;
}

/**
 * Receipt Parsing Service
 * Handles communication with Supabase RPC for receipt/invoice analysis
 */
export const receiptParsingService = {
  /**
   * Analyze receipt/invoice image using Gemini Vision API via RPC
   * @param imageBase64 - Base64-encoded image data
   * @param imageMimeType - MIME type of image (image/png or image/jpeg)
   * @returns Parsed receipt data with structured fields
   */
  async analyzeReceiptInvoice(
    imageBase64: string,
    imageMimeType: string
  ): Promise<AnalyzeReceiptInvoiceResponse> {
    const { data, error } = await safeRpc("analyze_receipt_invoice", {
      p_image_base64: imageBase64,
      p_image_mime_type: imageMimeType,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Lỗi phân tích hóa đơn",
      };
    }

    return {
      success: true,
      data: data as ParsedReceiptData,
    };
  },
};
