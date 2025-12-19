// src/services/storageService.ts
import { v4 as uuidv4 } from "uuid"; // Cần cài thư viện này

import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Tải file lên Supabase Storage và trả về URL công khai
 * @param file File cần tải lên
 * @param bucket Tên của bucket (vd: 'product_images')
 */
export const uploadFile = async (file: File, bucket: string) => {
  // 1. Tạo một tên file duy nhất để tránh trùng lặp
  const fileExt = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const filePath = `${fileName}`;

  // 2. Tải file lên
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) {
    console.error("Lỗi tải file:", uploadError);
    throw uploadError;
  }

  // 3. Lấy URL công khai của file vừa tải
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return data.publicUrl;
};
