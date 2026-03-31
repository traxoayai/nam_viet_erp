// src/features/finance/api/sepayService.ts
// Service layer cho SEPAY E-Invoice API
// Docs: https://developer.sepay.vn/vi/einvoice-api/v1/tong-quan

import type {
  SepayCreateInvoiceRequest,
  SepayCreateInvoiceResponse,
  SepayTrackingResponse,
} from "../types/sepay.types";

import { supabase } from "@/shared/lib/supabaseClient";

// SECURITY: SEPAY Bearer token KHÔNG được lưu client-side.
// Tất cả API calls đi qua Supabase Edge Function "sepay-proxy"
// để giữ token server-side.

export const sepayService = {
  /**
   * Tạo hóa đơn điện tử qua Supabase Edge Function proxy
   * Edge Function giữ SEPAY token server-side
   */
  async createInvoice(
    payload: SepayCreateInvoiceRequest
  ): Promise<SepayCreateInvoiceResponse> {
    const { data, error } = await supabase.functions.invoke("sepay-proxy", {
      body: { action: "create_invoice", payload },
    });

    if (error) {
      throw new Error(`SEPAY lỗi: ${error.message}`);
    }

    return data as SepayCreateInvoiceResponse;
  },

  /**
   * Kiểm tra trạng thái hóa đơn qua Edge Function proxy
   */
  async checkInvoiceStatus(
    trackingCode: string
  ): Promise<SepayTrackingResponse> {
    const { data, error } = await supabase.functions.invoke("sepay-proxy", {
      body: { action: "check_status", tracking_code: trackingCode },
    });

    if (error) {
      throw new Error(`SEPAY tracking lỗi: ${error.message}`);
    }

    return data as SepayTrackingResponse;
  },

  /**
   * Poll trạng thái cho đến khi hoàn thành hoặc thất bại
   */
  async pollUntilComplete(
    trackingCode: string,
    maxAttempts = 10,
    intervalMs = 3000
  ): Promise<SepayTrackingResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const result = await this.checkInvoiceStatus(trackingCode);
      const status = result.data?.status;
      if (status === "Success" || status === "completed" || status === "issued") return result;
      if (status === "Failed" || status === "failed") {
        throw new Error(
          result.data?.message || result.data?.error_message || "Xuất hóa đơn thất bại"
        );
      }
    }
    throw new Error("Timeout: Hóa đơn đang xử lý quá lâu");
  },
};
