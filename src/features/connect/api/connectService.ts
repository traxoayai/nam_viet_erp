import { supabase } from "@/shared/lib/supabaseClient";
import { ConnectPost, CreatePostPayload } from "../types/connect.types";

export const connectService = {
  // 1. Lấy danh sách bài đăng
  async fetchPosts(category: string): Promise<ConnectPost[]> {
    // Tạm thời query bảng, sau này có thể viết RPC get_posts_secure nếu cần join nhiều
    const { data, error } = await supabase
      .from('connect_posts')
      .select('*')
      .eq('category', category)
      .eq('status', 'published') // Chỉ lấy bài đã xuất bản
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Mock thêm thông tin author để UI đẹp (Do chưa join bảng profile)
    return data.map((post: any) => ({
      ...post,
      author_name: post.is_anonymous ? 'Ẩn danh' : 'Ban Giám Đốc',
      role: post.is_anonymous ? 'Nhân viên' : 'Administrator',
      likes_count: Math.floor(Math.random() * 50), // Mock
      comments_count: Math.floor(Math.random() * 10), // Mock
    }));
  },

  // 2. Tạo bài viết (Dùng RPC Core đã viết)
  async createPost(payload: CreatePostPayload) {
    const { error } = await supabase.rpc('create_connect_post', payload);
    if (error) throw error;
  },

  // 3. Xác nhận đã đọc (Dùng RPC Core đã viết)
  async confirmRead(postId: number) {
    const { error } = await supabase.rpc('confirm_post_read', { p_post_id: postId });
    if (error) throw error;
  },

  // 4. Xóa bài viết
  async deletePost(id: number) {
    const { error } = await supabase.from('connect_posts').delete().eq('id', id);
    if (error) throw error;
  },

  // 5. Khóa/Mở Khóa bình luận
  async toggleLock(id: number, currentLockStatus: boolean) {
    const { error } = await supabase
      .from('connect_posts')
      .update({ is_locked: !currentLockStatus })
      .eq('id', id);
    if (error) throw error;
  },

  // 6. Cập nhật bài viết
  async updatePost(id: number, payload: any) {
    const dbPayload = {
      category: payload.p_category,
      title: payload.p_title,
      content: payload.p_content,
      is_anonymous: payload.p_is_anonymous,
      must_confirm: payload.p_must_confirm,
      reward_points: payload.p_reward_points,
      // updated_at: new Date().toISOString() // Supabase trigger usually handles this, but can add if needed
    };
    
    const { error } = await supabase.from('connect_posts').update(dbPayload).eq('id', id);
    if (error) throw error;
  }
};
