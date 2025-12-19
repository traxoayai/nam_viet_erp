// src/services/roleService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import { Permission, Role } from "@/features/auth/types/role";

// 1. Tải danh sách Vai trò
export const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

// 2. Tải danh sách Quyền hạn (dạng phẳng)
export const fetchPermissions = async (): Promise<Permission[]> => {
  const { data, error } = await supabase
    .from("permissions")
    .select("*")
    .order("module", { ascending: true })
    .order("key", { ascending: true });
  if (error) throw error;
  return data || [];
};

// 3. Tải các quyền (đã check) của 1 vai trò
export const fetchRolePermissions = async (
  roleId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", roleId);
  if (error) throw error;
  return data.map((item) => item.permission_key);
};

// 4. Lưu quyền (Sử dụng RPC Sếp vừa tạo)
export const savePermissionsForRole = async (
  roleId: string,
  keys: string[]
) => {
  const { error } = await supabase.rpc("update_permissions_for_role", {
    p_role_id: roleId,
    p_permission_keys: keys,
  });
  if (error) throw error;
  return true;
};

// 5. Thêm vai trò mới
export const addRole = async (values: {
  name: string;
  description: string;
}) => {
  const { error } = await supabase.from("roles").insert(values);
  if (error) throw error;
  return true;
};

// 6. Cập nhật vai trò
export const updateRole = async (
  id: string,
  values: { name: string; description: string }
) => {
  const { error } = await supabase.from("roles").update(values).eq("id", id);
  if (error) throw error;
  return true;
};

// 7. Xóa vai trò
export const deleteRole = async (id: string) => {
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw error;
  return true;
};
