import { create } from 'zustand';
import { connectService } from '../api/connectService';
import { ConnectPost, PostCategory } from '../types/connect.types';

interface ConnectState {
  posts: ConnectPost[];
  loading: boolean;
  selectedPost: ConnectPost | null;
  activeTab: PostCategory;
  editingPost: ConnectPost | null; // [NEW]

  fetchPosts: (category: PostCategory) => Promise<void>;
  setSelectedPost: (post: ConnectPost | null) => void;
  setActiveTab: (tab: PostCategory) => void;
  confirmReadPost: (postId: number) => Promise<void>;
  
  // Actions
  deletePost: (id: number) => Promise<void>;
  toggleLockPost: (post: ConnectPost) => Promise<void>;
  setEditingPost: (post: ConnectPost | null) => void;
}

export const useConnectStore = create<ConnectState>((set, get) => ({
  posts: [],
  loading: false,
  selectedPost: null,
  activeTab: 'news',

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
              posts: state.posts.map(p => p.id === postId ? {...p, is_read: true} : p),
              selectedPost: state.selectedPost?.id === postId ? {...state.selectedPost, is_read: true} : state.selectedPost
          }));
      } catch (err) {
          console.error(err);
      }
  },

  // [NEW] Actions implementation
  editingPost: null,

  deletePost: async (id) => {
    try {
      await connectService.deletePost(id);
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
        selectedPost: state.selectedPost?.id === id ? null : state.selectedPost
      }));
    } catch (error) {
      console.error(error);
    }
  },

  toggleLockPost: async (post) => {
    try {
      await connectService.toggleLock(post.id, post.is_locked);
      set((state) => ({
        posts: state.posts.map((p) => 
          p.id === post.id ? { ...p, is_locked: !post.is_locked } : p
        ),
        selectedPost: state.selectedPost?.id === post.id 
          ? { ...state.selectedPost, is_locked: !post.is_locked } 
          : state.selectedPost
      }));
    } catch (error) {
      console.error(error);
    }
  },

  setEditingPost: (post) => set({ editingPost: post }),
}));
