// supabase/functions/create-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// [FIX]: Sử dụng Deno.serve thay vì import 'serve' từ std cũ
// Đây là chuẩn mới của Deno Runtime, giúp tránh lỗi EarlyDrop
Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 2. Lấy biến môi trường
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseServiceKey) {
      console.error("Thiếu SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Lỗi cấu hình Server: Thiếu Service Key");
    }

    // 3. Khởi tạo Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Kiểm tra người gọi (Auth Check)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Vui lòng đăng nhập.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 5. Parse Body
    const { email, password, fullName, roleId, branchId } = await req.json();

    // 6. Tạo User (Auth)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) throw createError;
    if (!newUser.user)
      throw new Error("Không tạo được user (Lỗi không xác định)");

    // 7. Lưu thông tin vào public.users (Upsert để an toàn)
    const { error: profileError } = await supabaseAdmin.from("users").upsert({
      id: newUser.user.id,
      full_name: fullName,
      email: email,
      status: "active",
      created_at: new Date().toISOString(),
    });

    if (profileError) console.error("Lỗi tạo profile:", profileError);

    // 8. Gán quyền
    if (roleId && branchId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUser.user.id,
          role_id: roleId,
          branch_id: branchId,
        });
      if (roleError) console.error("Lỗi gán quyền:", roleError);
    }

    // 9. Trả về thành công
    return new Response(
      JSON.stringify({
        success: true,
        user: newUser.user,
        message: "Tạo user thành công!",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 200,
      }
    );
  } catch (error: any) {
    // Catch-all lỗi để không bị crash
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 400,
    });
  }
});
