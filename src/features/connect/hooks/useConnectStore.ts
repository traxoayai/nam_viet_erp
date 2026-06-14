// src/features/connect/hooks/useConnectStore.ts
import { create } from "zustand";

import { connectService } from "../api/connectService";
import { ConnectPost, PostCategory } from "../types/connect.types";

interface ConnectState {
  posts: ConnectPost[];
  loading: boolean;
  selectedPost: ConnectPost | null;
  activeTab: PostCategory;
  editingPost: ConnectPost | null; // [NEW] - Fixed missing type
  // [NEW] Interactive State
  comments: unknown[];
  commentsLoading: boolean;

  // Actions
  fetchPosts: (category: PostCategory) => Promise<void>;
  setSelectedPost: (post: ConnectPost | null) => void;
  setActiveTab: (tab: PostCategory) => void;
  confirmReadPost: (postId: number) => Promise<void>;

  deletePost: (id: number) => Promise<void>;
  toggleLockPost: (post: ConnectPost) => Promise<void>;
  setEditingPost: (post: ConnectPost | null) => void;

  // Interactive Actions
  toggleLikeAction: (post: ConnectPost) => Promise<void>;
  loadComments: (postId: number) => Promise<void>;
  submitCommentAction: (postId: number, content: string) => Promise<void>;
}

export const useConnectStore = create<ConnectState>((set, get) => ({
  posts: [],
  loading: false,
  selectedPost: null,
  activeTab: "news",
  editingPost: null, // [NEW] Actions implementation

  // [NEW] Interactive State Init
  comments: [],
  commentsLoading: false,

  fetchPosts: async (category) => {
    set({ loading: true, activeTab: category, selectedPost: null }); // Reset selection khi đổi tab
    try {
      const data = await connectService.fetchPosts(category);
      set({ posts: data });
    } catch (err) {
      console.error(err);
    } finally {
      set({ loading: false });
    }
  },

  setSelectedPost: (post) => set({ selectedPost: post }),
  setActiveTab: (tab) => {
    // Khi set Tab thì gọi luôn fetch
    get().fetchPosts(tab);
  },

  confirmReadPost: async (postId) => {
    try {
      await connectService.confirmRead(postId);
      // Cập nhật local state để ẩn nút confirm ngay lập tức
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, is_read: true } : p
        ),
        selectedPost:
          state.selectedPost?.id === postId
            ? { ...state.selectedPost, is_read: true }
            : state.selectedPost,
      }));
    } catch (err) {
      console.error(err);
    }
  },

  deletePost: async (id) => {
    try {
      await connectService.deletePost(id);
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
        selectedPost: state.selectedPost?.id === id ? null : state.selectedPost,
      }));
    } catch (error) {
      console.error(error);
    }
  },

  toggleLockPost: async (post) => {
    try {
      await connectService.toggleLock(post.id, post.is_locked);
      // Helper update logic
      const updateLock = (p: ConnectPost) =>
        p.id === post.id ? { ...p, is_locked: !p.is_locked } : p;

      set((state) => ({
        posts: state.posts.map(updateLock),
        selectedPost: state.selectedPost
          ? updateLock(state.selectedPost)
          : null,
      }));
    } catch (error) {
      console.error(error);
    }
  },

  setEditingPost: (post) => set({ editingPost: post }),

  // [NEW] Interactive Actions Implementation
  toggleLikeAction: async (post) => {
    console.log("🔥 Đã bấm nút Like! Post ID:", post.id); // <--- THÊM DÒNG NÀY
    const isLiked = post.user_has_liked;
    // 1. Optimistic Update (Cập nhật giao diện ngay lập tức)
    const newStatus = !isLiked;
    const newCount = isLiked ? post.likes_count - 1 : post.likes_count + 1;

    // Helper update list
    const updateLocalPost = (p: ConnectPost) =>
      p.id === post.id
        ? { ...p, user_has_liked: newStatus, likes_count: newCount }
        : p;

    set((state) => ({
      posts: state.posts.map(updateLocalPost),
      selectedPost: state.selectedPost
        ? updateLocalPost(state.selectedPost)
        : null,
    }));

    // 2. Gọi Server (Nếu lỗi thì revert - xử lý sau, tạm thời tin tưởng server)
    try {
      await connectService.toggleLike(post.id, isLiked);
    } catch (err) {
      console.error("Lỗi like:", err);
      // Revert lại nếu cần thiết (TODO)
    }
  },

  loadComments: async (postId) => {
    set({ commentsLoading: true });
    try {
      const data = await connectService.fetchComments(postId);
      set({ comments: data || [] });
    } catch (err) {
      console.error(err);
    } finally {
      set({ commentsLoading: false });
    }
  },

  submitCommentAction: async (postId, content) => {
    try {
      await connectService.sendComment(postId, content);
      // Reload comment và update count ở post list
      await get().loadComments(postId);

      // Update comment count ở list ngoài
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
        ),
        selectedPost: state.selectedPost
          ? {
              ...state.selectedPost,
              comments_count: state.selectedPost.comments_count + 1,
            }
          : null,
      }));
    } catch (err) {
      throw err; // Ném lỗi ra để UI hiển thị message
    }
  },
}));
