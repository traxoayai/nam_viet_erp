// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Khởi tạo Client với quyền Admin (Service Role)
    // Biến môi trường này có sẵn trên Supabase Edge Runtime
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 3. Xác thực người gọi (Authentication)
    // Lấy JWT từ Header người dùng gửi lên để biết "Ai đang gọi hàm này?"
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Bạn cần đăng nhập để thực hiện thao tác này.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Kiểm tra Phân quyền (Authorization)
    // Truy vấn vào bảng user_roles để xem người gọi (caller.id) có phải là Admin/Manager không
    // Giả định Sếp đã có bảng roles với name là 'admin' hoặc 'manager'
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", caller.id);

    const isAuthorized = callerRoles?.some((r: any) =>
      ["admin", "manager", "Admin", "Manager"].includes(r.roles?.name)
    );

    // Nếu không phải Admin/Manager -> Chặn ngay
    // (Sếp có thể comment đoạn này nếu muốn test nhanh, nhưng nên bật để bảo mật)
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Bạn không có quyền tạo nhân viên mới.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Lấy dữ liệu đầu vào
    const { email, password, fullName, roleId, branchId } = await req.json();

    if (!email || !password || !fullName) {
      throw new Error("Thiếu thông tin bắt buộc (email, password, fullName)");
    }

    // 6. TẠO USER MỚI (Core Action)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Tự động xác thực email luôn
        user_metadata: { full_name: fullName },
      });

    if (createError) throw createError;

    if (!newUser.user) throw new Error("Không thể tạo user.");

    // 7. Gán quyền và Thông tin bổ sung (Transaction Logic)
    // Bước A: Update bảng public.users (Trigger handle_new_user có thể đã chạy, ta update thêm thông tin)
    const { error: updateProfileError } = await supabaseAdmin
      .from("users")
      .update({
        full_name: fullName,
        status: "active", // Mặc định active luôn
      })
      .eq("id", newUser.user.id);

    // Bước B: Insert vào bảng phân quyền user_roles
    if (roleId && branchId) {
      const { error: assignRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUser.user.id,
          role_id: roleId,
          branch_id: branchId,
        });

      if (assignRoleError) {
        // Nếu lỗi gán quyền, ta có thể cân nhắc xóa user vừa tạo hoặc trả về warning
        console.error("Lỗi gán quyền:", assignRoleError);
      }
    }

    // 8. Trả về kết quả thành công
    return new Response(
      JSON.stringify({
        success: true,
        user: newUser.user,
        message: "Tạo nhân viên thành công!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
