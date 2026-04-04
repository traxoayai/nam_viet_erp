// src/features/connect/api/connectService.ts
import { ConnectPost, CreatePostPayload } from "../types/connect.types";

import type { Database } from "@/shared/lib/database.types";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export const connectService = {
  // 1. Lấy danh sách bài đăng (Dùng RPC V2 Smart Search)
  async fetchPosts(category: string, search?: string): Promise<ConnectPost[]> {
    const { data } = await safeRpc("get_connect_posts", {
      p_category: category,
      p_search: search || undefined,
      p_limit: 50,
      p_offset: 0,
    });

    // RPC trả về attachments dạng Json, cần map về obj nếu chưa đúng format
    type PostRow = ConnectPost & { attachments: string | { name: string; url: string; type: string }[] | null };
    const rows = (data || []) as unknown as PostRow[];
    return rows.map((post) => ({
      ...post,
      attachments: post.attachments
        ? typeof post.attachments === "string"
          ? JSON.parse(post.attachments)
          : post.attachments
        : [],
    })) as ConnectPost[];
  },

  // 2. Tạo bài viết (Dùng RPC Core đã viết)
  async createPost(payload: CreatePostPayload) {
    await safeRpc("create_connect_post", {
      p_category: payload.p_category,
      p_title: payload.p_title,
      p_content: payload.p_content,
      p_is_anonymous: payload.p_is_anonymous,
      p_must_confirm: payload.p_must_confirm,
      p_reward_points: payload.p_reward_points,
      p_attachments: payload.p_attachments as unknown as Database["public"]["Functions"]["create_connect_post"]["Args"]["p_attachments"],
    });
  },

  // 3. Xác nhận đã đọc (Dùng RPC Core đã viết)
  async confirmRead(postId: number) {
    await safeRpc("confirm_post_read", {
      p_post_id: postId,
    });
  },

  // 4. Xóa bài viết
  async deletePost(id: number) {
    const { error } = await supabase
      .from("connect_posts")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // 5. Khóa/Mở Khóa bình luận
  async toggleLock(id: number, currentLockStatus: boolean) {
    const { error } = await supabase
      .from("connect_posts")
      .update({ is_locked: !currentLockStatus })
      .eq("id", id);
    if (error) throw error;
  },

  // 6. Cập nhật bài viết
  async updatePost(id: number, payload: Partial<CreatePostPayload>) {
    const dbPayload = {
      category: payload.p_category,
      title: payload.p_title,
      content: payload.p_content,
      is_anonymous: payload.p_is_anonymous,
      must_confirm: payload.p_must_confirm,
      reward_points: payload.p_reward_points,
      // updated_at: new Date().toISOString() // Supabase trigger usually handles this, but can add if needed
    };

    const { error } = await supabase
      .from("connect_posts")
      .update(dbPayload)
      .eq("id", id);
    if (error) throw error;
  },

  // 7. Toggle Like (REST API)
  async toggleLike(postId: number, isLiked: boolean) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Unauthorized");

    if (isLiked) {
      // Unlike
      const { error } = await supabase
        .from("connect_likes")
        .delete()
        .match({ post_id: postId, user_id: user.id });
      if (error) throw error;
    } else {
      // Like
      const { error } = await supabase
        .from("connect_likes")
        .insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    }
  },

  // 8. Gửi Comment
  async sendComment(postId: number, content: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("connect_comments")
      .insert({ post_id: postId, content: content.trim(), user_id: user.id }); // Ensure user_id is sent if RLS requires it or it's not auto-inferred
    if (error) throw error;
  },

  // 9. Lấy danh sách Comment
  async fetchComments(postId: number) {
    const { data, error } = await supabase
      .from("connect_comments")
      .select(
        `
        id, content, created_at, user_id,
        users ( full_name, avatar_url )
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  },
};
