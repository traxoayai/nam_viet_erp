// supabase/functions/create-user/index.ts
// [SECURITY FIX] C4: CORS restriction, input validation, permission check
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").filter(Boolean);

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.length === 0) return origin; // Fallback: nếu chưa config thì cho qua (dev)
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
}

function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    // 2. Env vars
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseServiceKey) {
      throw new Error("Lỗi cấu hình Server: Thiếu Service Key");
    }

    // 3. Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 4. Auth Check - verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user: caller }, error: authError } =
      await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Vui lòng đăng nhập." }),
        { status: 401, headers: corsHeaders(req) }
      );
    }

    // 5. Permission Check - only admin can create users
    const { data: callerPerms } = await supabaseAdmin.rpc("get_my_permissions_for_user", {
      p_user_id: caller.id,
    });

    const permissions: string[] = callerPerms || [];
    const isAdmin = permissions.includes("admin-all");

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Bạn không có quyền tạo user." }),
        { status: 403, headers: corsHeaders(req) }
      );
    }

    // 6. Parse & Validate Body
    const { email, password, fullName, roleId, branchId } = await req.json();

    // Email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email không hợp lệ." }),
        { status: 400, headers: corsHeaders(req) }
      );
    }

    // Password validation (match config min_password_length = 6)
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Mật khẩu phải có ít nhất 6 ký tự." }),
        { status: 400, headers: corsHeaders(req) }
      );
    }

    // Name validation
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Họ tên không hợp lệ (tối thiểu 2 ký tự)." }),
        { status: 400, headers: corsHeaders(req) }
      );
    }

    // Role validation - prevent assigning admin role by non-super-admin
    if (roleId) {
      const { data: roleData } = await supabaseAdmin
        .from("roles")
        .select("name")
        .eq("id", roleId)
        .single();

      if (roleData?.name?.toLowerCase() === "admin" && !isAdmin) {
        return new Response(
          JSON.stringify({ error: "Không thể gán role Admin." }),
          { status: 403, headers: corsHeaders(req) }
        );
      }
    }

    // 7. Create Auth User
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) throw createError;
    if (!newUser.user) throw new Error("Không tạo được user");

    // 8. Create profile
    const { error: profileError } = await supabaseAdmin.from("users").upsert({
      id: newUser.user.id,
      full_name: fullName,
      email,
      status: "active",
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      // Rollback: delete auth user since profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: "Loi tao profile: " + profileError.message }),
        { status: 500, headers: corsHeaders(req) }
      );
    }

    // 9. Assign role
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

    // 10. Success
    return new Response(
      JSON.stringify({ success: true, user: newUser.user, message: "Tạo user thành công!" }),
      { headers: corsHeaders(req), status: 200 }
    );
  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: corsHeaders(req), status: 400 }
    );
  }
});
