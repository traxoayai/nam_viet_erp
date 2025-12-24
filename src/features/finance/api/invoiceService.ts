// src/services/invoiceService.ts
import { v4 as uuidv4 } from "uuid";

import { supabase } from "@/shared/lib/supabaseClient";

export const invoiceService = {
  // 1. Upload ảnh lên Bucket 'invoices'
  async uploadInvoiceImage(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `raw/${fileName}`;

    const { error } = await supabase.storage
      .from("invoices")
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage.from("invoices").getPublicUrl(filePath);
    return data.publicUrl;
  },

  // 2. Gọi AI Scan (FIXED: Simple Object Body)
  async scanInvoiceWithAI(fileUrl: string, mimeType: string = "image/jpeg") {
    console.log("[Frontend] Calling AI Scan (Clean Object)...", {
      fileUrl,
      mimeType,
    });

    const { data, error } = await supabase.functions.invoke(
      "scan-invoice-gemini",
      {
        // FIX: Truyền Object trực tiếp, KHÔNG stringify, KHÔNG header thủ công.
        // SDK sẽ tự động xử lý tất cả.
        body: {
          file_url: fileUrl,
          mime_type: mimeType,
        },
      }
    );

    if (error) {
      console.error("Edge Function Error Detail:", error);

      // --- CẬP NHẬT MỚI: Xử lý lỗi 409 (Trùng lặp) từ CORE ---
      // Supabase Functions trả về lỗi trong object `error` hoặc `context`
      // CORE trả về JSON { success: false, error: "..." } nên ta ưu tiên lấy message đó

      let errorMsg = "Lỗi quét hóa đơn";

      // Case 1: Lỗi từ response JSON của Function (CORE custom error)
      // (Lưu ý: supabase-js đôi khi ném lỗi, đôi khi trả về data chứa error)

      // Nếu data trả về có success: false (dù status 200)
      if (data && data.success === false) {
        errorMsg = data.error;
      }
      // Nếu throw error (status 4xx/5xx)
      else if (typeof error === "object" && error !== null) {
        // Thử lấy message từ body response nếu có
        // (Supabase client wraps error, ta cố gắng lấy message chuẩn nhất)
        errorMsg =
          (error as any).message ||
          (error as any).context?.statusText ||
          "Lỗi không xác định từ AI";
      }

      // Check keyword từ CORE để hiển thị đẹp hơn
      if (errorMsg.includes("đã được nhập kho")) {
        errorMsg = "⚠️ CẢNH BÁO: " + errorMsg; // Thêm icon cảnh báo
      }

      throw new Error(errorMsg);
    }

    console.log("[Frontend] AI Scan Success:", data);
    return data;
  },

  // 3. Lấy danh sách Hóa đơn
  async getInvoices(page: number, pageSize: number, filters: any) {
    let query = supabase
      .from("finance_invoices")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.search) {
      query = query.or(
        `invoice_number.ilike.%${filters.search}%,supplier_name_raw.ilike.%${filters.search}%`
      );
    }
    if (filters.dateFrom && filters.dateTo) {
      query = query
        .gte("invoice_date", filters.dateFrom)
        .lte("invoice_date", filters.dateTo);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], total: count || 0 };
  },

  // 4. Xóa hóa đơn
  async deleteInvoice(id: number) {
    const { error } = await supabase
      .from("finance_invoices")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  // 1. Hàm gọi VAT Engine
  async processVatEntry(invoiceId: number) {
    const { error } = await supabase.rpc("process_vat_invoice_entry", {
      p_invoice_id: invoiceId
    });
    if (error) console.error("⚠️ Lỗi nhập kho VAT:", error);
  },

  // 3. Hàm Tạo Mới (Insert)
  async createInvoice(payload: any) {
    const { data, error } = await supabase
      .from("finance_invoices")
      .insert([{ 
          ...payload, 
          status: "verified", 
          created_at: new Date().toISOString() 
      }])
      .select()
      .single(); // Insert luôn trả về 1 dòng nên dùng single() ok

    if (error) throw error;

    // Kích hoạt nhập kho VAT
    if (data && data.id) await this.processVatEntry(data.id);
    
    return data;
  },

  // 4. Hàm Cập Nhật (Update) - FIX LỖI PGRST116 TẠI ĐÂY
  async verifyInvoice(id: number, payload: any) {
    const { data, error } = await supabase
      .from("finance_invoices")
      .update({ 
          ...payload, 
          status: "verified" 
      })
      .eq("id", id)
      .select()
      .maybeSingle(); // <-- DÙNG MAYBESINGLE ĐỂ TRÁNH CRASH NẾU KHÔNG TÌM THẤY

    if (error) throw error;
    
    if (!data) throw new Error("Không tìm thấy hóa đơn để cập nhật (ID sai hoặc không có quyền).");

    // Kích hoạt nhập kho VAT
    if (data && data.id) await this.processVatEntry(data.id);

    return true;
  },

  // [NEW] Kiểm tra trùng lặp
  async checkInvoiceExists(taxCode: string, symbol: string, number: string) {
    const { data, error } = await supabase.rpc("check_invoice_exists", {
      p_tax_code: taxCode,
      p_symbol: symbol,
      p_number: number,
    });
    if (error) throw error;
    return data as boolean; // True nếu đã tồn tại
  },

  // 2. Hàm Lấy Mapping (Sửa lại để tránh lỗi null unit)
  async getMappedProduct(taxCode: string, productName: string, vendorUnit: string) {
    const { data, error } = await supabase.rpc("get_mapped_product", {
      p_tax_code: taxCode,
      p_product_name: productName,
      p_vendor_unit: vendorUnit || "" // <-- QUAN TRỌNG: Tránh gửi null/undefined
    });
    if (error) throw error;
    
    if (data && data.length > 0) {
        return {
            productId: data[0].internal_product_id,
            unit: data[0].internal_unit
        };
    }
    return null;
  },

  // [UPDATED] Lưu mapping mới (Có thêm Unit)
  async saveProductMapping(taxCode: string, productName: string, vendorUnit: string, internalId: number, internalUnit: string) {
      const { error } = await supabase
        .from('vendor_product_mappings')
        .upsert(
            { 
                vendor_tax_code: taxCode, 
                vendor_product_name: productName,
                vendor_unit: vendorUnit,    // <-- Mới thêm
                internal_product_id: internalId,
                internal_unit: internalUnit, // <-- Mới thêm
                last_used_at: new Date().toISOString()
            },
            { onConflict: 'vendor_tax_code, vendor_product_name, vendor_unit' } // <-- Constraint mới
        );
      if (error) console.error("Auto-learn mapping failed:", error); 
  }
};
