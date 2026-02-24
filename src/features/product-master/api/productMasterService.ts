// [REPLACE] Thay thế toàn bộ nội dung file productMasterService.ts

import {
  ProductMasterImportPayload,
  ProductMasterExportItem,
} from "../types/master.types";

import { supabase } from "@/shared/lib/supabaseClient";

export const productMasterService = {
  // 1. Export Data (FIXED: Loop to fetch ALL rows, bypassing 1000 limit)
  async exportMasterData(): Promise<ProductMasterExportItem[]> {
    let allData: ProductMasterExportItem[] = [];
    let page = 0;
    const PAGE_SIZE = 1000; // Giới hạn max của Supabase
    let hasMore = true;

    // Vòng lặp lấy dữ liệu cho đến khi hết
    while (hasMore) {
      const { data, error } = await supabase
        .rpc("export_product_master_v2")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1); // Lấy từ... đến...

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];

        // Nếu số lượng lấy về ít hơn limit -> Đã là trang cuối
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++; // Tăng trang để lấy tiếp
        }
      } else {
        hasMore = false; // Không còn dữ liệu
      }
    }

    return allData;
  },

  // 2. Import Data (With Chunking - Giữ nguyên logic tốt cũ)
  async importMasterData(payload: ProductMasterImportPayload[]) {
    const CHUNK_SIZE = 100;
    let processed = 0;
    const total = payload.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.rpc("import_product_master_v2", {
        p_data: chunk,
      });

      if (error) {
        console.error(`Import Error at chunk ${i}:`, error, chunk);
        throw new Error(`Lỗi import từ dòng ${i + 1}: ${error.message}`);
      }

      processed += chunk.length;
    }

    return processed;
  },
};
