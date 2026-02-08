export type PostCategory = 'news' | 'feedback' | 'docs';
export type PostStatus = 'draft' | 'published' | 'hidden';
export type PostPriority = 'normal' | 'high';

export interface ConnectPost {
  id: number;
  category: PostCategory;
  title: string;
  summary?: string;
  content?: string;
  
  is_pinned: boolean;
  is_anonymous: boolean;
  priority: PostPriority;
  status: PostStatus;
  is_locked: boolean;
  
  must_confirm: boolean;
  reward_points: number;
  
  feedback_response?: string;
  // response_by?: string; // Tạm bỏ vì RPC chưa trả về
  
  created_at: string;
  updated_at?: string;

  // [NEW] Fields from RPC get_connect_posts
  creator_name: string;      
  creator_id?: string;
  creator_avatar?: string;   
  likes_count: number;       
  comments_count: number;    
  user_has_liked: boolean;   
  is_read?: boolean; // Client-side logic or future RPC update
  
  tags: string[];
  attachments: { name: string; url: string; type: string }[] | null; 
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
