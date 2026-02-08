export type PostCategory = 'news' | 'feedback' | 'docs';
export type PostStatus = 'draft' | 'published' | 'hidden';
export type PostPriority = 'normal' | 'high';

export interface ConnectPost {
  id: number;
  created_at: string;
  creator_id: string;
  category: PostCategory;
  title: string;
  summary?: string;
  content?: string;
  
  is_pinned: boolean;
  is_anonymous: boolean;
  priority: PostPriority;
  status: PostStatus;
  is_locked: boolean; // [NEW]
  
  must_confirm: boolean;
  reward_points: number;
  
  feedback_response?: string;
  response_by?: string;
  
  tags: string[];
  attachments: { name: string; url: string; type: string }[]; // JSONB
  
  // View fields (sẽ join hoặc mock tạm)
  author_name?: string; 
  author_avatar?: string;
  role?: string;
  
  // Interactive stats
  likes_count?: number;
  comments_count?: number;
  is_read?: boolean; // User hiện tại đã đọc chưa
}

export interface CreatePostPayload {
  p_category: string;
  p_title: string;
  p_content: string;
  p_is_anonymous?: boolean;
  p_must_confirm?: boolean;
  p_reward_points?: number;
  p_attachments?: any[];
}
