// src/services/invoiceService.ts
import { v4 as uuidv4 } from "uuid";

import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

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

      // --- CẬP NHẬT MỚI: Xử lý lỗi 409 (Trùng lặp) ---
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
      .select("*, suppliers:supplier_id(name)", { count: "exact" })
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

  // 3b. Lấy hóa đơn theo ID
  async getInvoiceById(id: number) {
    const { data, error } = await supabase
      .from("finance_invoices")
      .select("*, suppliers:supplier_id(name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  // 4. Xóa hóa đơn (Atomic: reverse VAT + delete trong 1 transaction)
  async deleteInvoice(id: number) {
    try {
      // Ưu tiên gọi RPC atomic nếu tồn tại
      await safeRpc("delete_invoice_atomic", { p_invoice_id: id });
      return true;
    } catch (atomicError: any) {
      // Fallback: Nếu RPC chưa tồn tại, dùng flow cũ (2 bước)
      if (atomicError.message?.includes("does not exist")) {
        console.warn("RPC delete_invoice_atomic chưa tồn tại, dùng flow cũ");

        try {
          await safeRpc("reverse_vat_invoice_entry", { p_invoice_id: id });
        } catch (rpcError: any) {
          if (rpcError.message?.includes("violates check constraint")) {
            throw new Error(
              "Không thể xóa: Tồn kho VAT không đủ để trừ (hàng đã được xuất bán)."
            );
          }
          throw rpcError;
        }

        const { error: deleteError } = await supabase
          .from("finance_invoices")
          .delete()
          .eq("id", id);
        if (deleteError) throw deleteError;

        return true;
      } else {
        if (atomicError.message?.includes("violates check constraint")) {
          throw new Error(
            "Không thể xóa: Tồn kho VAT không đủ để trừ (hàng đã được xuất bán)."
          );
        }
        throw atomicError;
      }
    }
  },

  // 1. Hàm gọi VAT Engine
  async processVatEntry(invoiceId: number) {
    await safeRpc("process_vat_invoice_entry", {
      p_invoice_id: invoiceId,
    });
  },

  // 3. Hàm Tạo Mới (Insert) - Luôn tạo draft, KHÔNG tự động nhập kho VAT
  async createInvoice(payload: any) {
    const { data, error } = await supabase
      .from("finance_invoices")
      .insert([
        {
          ...payload,
          status: "draft",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  // 4. Xác nhận hóa đơn + nhập kho VAT
  async verifyInvoice(id: number, payload: any) {
    // Check status hiện tại — chỉ verify từ draft
    const { data: existing } = await supabase
      .from("finance_invoices")
      .select("status")
      .eq("id", id)
      .single();

    if (existing && existing.status === "verified") {
      // Đã verified rồi — chỉ update payload, KHÔNG gọi processVatEntry lần 2
      const { error } = await supabase
        .from("finance_invoices")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      return true;
    }

    if (existing && existing.status !== "draft") {
      throw new Error(`Không thể verify: Hóa đơn đang ở trạng thái "${existing.status}"`);
    }

    const { data, error } = await supabase
      .from("finance_invoices")
      .update({
        ...payload,
        status: "verified",
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Không tìm thấy hóa đơn để cập nhật.");

    // Nhập kho VAT (chỉ lần đầu verify)
    if (data.id) await this.processVatEntry(data.id);

    return true;
  },

  // [NEW] Kiểm tra trùng lặp
  async checkInvoiceExists(taxCode: string, symbol: string, number: string) {
    const { data } = await safeRpc("check_invoice_exists", {
      p_tax_code: taxCode,
      p_symbol: symbol,
      p_number: number,
    });
    return data as boolean; // True nếu đã tồn tại
  },

  // 5. Lưu Nháp (Create/Update with status='draft', Skip VAT Entry)
  async saveDraft(id: number | null, payload: any) {
    const draftPayload = { ...payload, status: "draft" };

    let res;
    if (id) {
      // Update — chỉ cho phép update nếu đang ở trạng thái draft
      const { data: existing } = await supabase
        .from("finance_invoices")
        .select("status")
        .eq("id", id)
        .single();

      if (existing && existing.status !== "draft") {
        throw new Error(`Không thể lưu nháp: Hóa đơn đang ở trạng thái "${existing.status}"`);
      }

      res = await supabase
        .from("finance_invoices")
        .update(draftPayload)
        .eq("id", id)
        .select()
        .single();
    } else {
      // Create
      res = await supabase
        .from("finance_invoices")
        .insert([{ ...draftPayload, created_at: new Date().toISOString() }])
        .select()
        .single();
    }

    const { data, error } = res;
    if (error) throw error;
    return data;
  },

  // 2. Hàm Lấy Mapping (Sửa lại để tránh lỗi null unit)
  async getMappedProduct(
    taxCode: string,
    productName: string,
    vendorUnit: string
  ) {
    const { data } = await safeRpc("get_mapped_product", {
      p_tax_code: taxCode,
      p_product_name: productName,
      p_vendor_unit: vendorUnit || "", // <-- QUAN TRỌNG: Tránh gửi null/undefined
    });

    if (data && data.length > 0) {
      return {
        productId: data[0].internal_product_id,
        unit: data[0].internal_unit,
      };
    }
    return null;
  },

  // [UPDATED] Lưu mapping mới (Có thêm Unit)
  async saveProductMapping(
    taxCode: string,
    productName: string,
    vendorUnit: string,
    internalId: number,
    internalUnit: string
  ) {
    const { error } = await supabase.from("vendor_product_mappings").upsert(
      {
        vendor_tax_code: taxCode,
        vendor_product_name: productName,
        vendor_unit: vendorUnit, // <-- Mới thêm
        internal_product_id: internalId,
        internal_unit: internalUnit, // <-- Mới thêm
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "vendor_tax_code, vendor_product_name, vendor_unit" } // <-- Constraint mới
    );
    if (error) throw new Error("Luu mapping that bai: " + error.message);
  },

  // Tạo hóa đơn xuất kho VAT (Outbound - Trừ kho)
  async createOutboundInvoice(payload: any) {
    const { data, error } = await supabase
      .from("finance_invoices")
      .insert([
        {
          invoice_number: payload.invoice_number,
          invoice_symbol: payload.invoice_symbol,
          invoice_date: payload.invoice_date,
          supplier_name_raw: payload.supplier_name_raw,
          buyer_tax_code: payload.buyer_tax_code,
          total_amount_pre_tax: payload.total_amount_pre_tax,
          tax_amount: payload.total_tax,
          total_amount_post_tax: payload.total_amount_post_tax,
          direction: "outbound",
          status: "verified_outbound",
          raw_items: payload.items,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Gọi RPC trừ kho VAT
    if (data?.id) {
      try {
        await safeRpc("process_vat_export_entry", { p_invoice_id: data.id });
      } catch (rpcError: any) {
        // Rollback: delete the invoice that was just created
        const { error: deleteError } = await supabase
          .from("finance_invoices")
          .delete()
          .eq("id", data.id);
        if (deleteError) {
          throw new Error(
            `Lỗi trừ kho VAT: ${rpcError.message}. ROLLBACK THẤT BẠI — cần xóa thủ công HĐ #${data.id}`
          );
        }
        throw new Error(`Lỗi trừ kho VAT: ${rpcError.message}`);
      }
    }

    return data;
  },
};
