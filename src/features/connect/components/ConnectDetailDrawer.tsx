// src/features/connect/components/ConnectDetailDrawer.tsx
import { 
  X, Calendar, Clock, Shield, CheckCircle, 
  AlertTriangle, Download, FileText, Send, Lock, ThumbsUp, MessageSquare 
} from 'lucide-react';
import { useConnectStore } from '../hooks/useConnectStore';
import dayjs from 'dayjs';
import { Button, message } from 'antd';
import { useEffect, useState } from 'react';

export const ConnectDetailDrawer = () => {
  const { selectedPost, setSelectedPost, confirmReadPost, comments, loadComments, submitCommentAction, toggleLikeAction } = useConnectStore();
  const [isVisible, setIsVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  // Load comment khi mở bài
  useEffect(() => {
    if (selectedPost) {
      loadComments(selectedPost.id);
    }
  }, [selectedPost?.id]);
  
  const handleSend = async () => {
      if (!commentText.trim()) return;
      setSending(true);
      try {
        await submitCommentAction(selectedPost!.id, commentText);
        setCommentText(''); 
      } catch (e) {
        message.error('Gửi thất bại');
      } finally {
        setSending(false);
      }
  };

  useEffect(() => {
    if (selectedPost) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedPost]);

  if (!selectedPost && !isVisible) return null;
  const post = selectedPost; 

  return (
    <div className="relative z-[100]">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 ${
          selectedPost ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSelectedPost(null)}
      ></div>

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-screen w-[800px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-out border-l border-slate-200 flex flex-col ${
          selectedPost ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {post && (
          <>
            {/* Header */}
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 z-20">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                 <span className="flex items-center gap-1"><Calendar size={12}/> {dayjs(post.created_at).format('DD/MM/YYYY')}</span>
                 <span className="flex items-center gap-1"><Clock size={12}/> {dayjs(post.created_at).format('HH:mm')}</span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full text-slate-600 transition">
                <X size={18} />
              </button>
            </div>

            {/* Content Container - THÊM pb-32 ĐỂ KHÔNG BỊ FOOTER CHE MẤT */}
            <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-white pb-32">
              <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-6">{post.title}</h1>

              {/* Author Box */}
              <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-md border border-slate-100">
                 {post.creator_avatar ? 
                    <img src={post.creator_avatar.startsWith('http') ? post.creator_avatar : `https://api.namviet.com${post.creator_avatar}`} alt="" className="w-10 h-10 rounded-full object-cover border"/> 
                    : <div className={`w-10 h-10 rounded flex items-center justify-center text-white font-bold ${post.is_anonymous ? 'bg-purple-600' : 'bg-blue-600'}`}>
                        {post.is_anonymous ? <Shield size={20}/> : (post.creator_name?.charAt(0) || 'A')}
                      </div>
                 }
                 <div className="flex-1">
                    <div className="font-bold text-slate-800 text-sm">
                        {post.is_anonymous ? 'Người giấu tên' : post.creator_name}
                    </div>
                 </div>
                 
                 {/* [FIX 1] NÚT LIKE NHỎ TRÊN HEADER ĐÃ ĐƯỢC GẮN HÀM */}
                 <div className="ml-auto flex items-center gap-4">
                     <div className="flex flex-col items-center">
                         <Button 
                            type="text" 
                            size="small" 
                            onClick={() => toggleLikeAction(post)} // <-- ĐÃ GẮN HÀM
                            icon={<ThumbsUp size={18} className={post.user_has_liked ? "text-blue-600 fill-blue-50" : "text-gray-400"} />} 
                         />
                         <span className="text-[10px] font-bold text-slate-500">{post.likes_count}</span>
                     </div>
                 </div>
              </div>

              {/* HTML Content */}
              <div 
                className="prose prose-sm max-w-none text-slate-800 leading-7"
                dangerouslySetInnerHTML={{ __html: post.content || '' }}
              />

              {/* Attachments */}
              {post.attachments && post.attachments.length > 0 && (
                 <div className="mt-8 pt-4 border-t border-slate-100">
                     <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Download size={16}/> Tài liệu đính kèm ({post.attachments.length})</h4>
                     <div className="grid grid-cols-1 gap-2">
                        {post.attachments.map((file: any, idx: number) => (
                             <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                 <div className="flex items-center gap-2 overflow-hidden">
                                     <FileText size={16} className="text-blue-500 shrink-0"/>
                                     <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                 </div>
                                 <Button type="link" size="small" className="text-blue-600" href={file.url} target="_blank">
                                     Tải về
                                 </Button>
                             </div>
                        ))}
                     </div>
                 </div>
              )}

              {/* Confirm Action */}
              {post.category === 'news' && post.must_confirm && !post.is_read && (
                 <div className="mt-8 bg-blue-50 border border-blue-200 p-5 rounded-md flex items-center justify-between">
                    <div>
                      <h4 className="text-blue-900 font-bold text-sm mb-1 flex items-center gap-1"><AlertTriangle size={14}/> Yêu cầu xác nhận</h4>
                      <p className="text-blue-700 text-xs">Xác nhận bạn đã đọc và hiểu nội dung này.</p>
                    </div>
                    <Button 
                        type="primary" 
                        onClick={() => {
                            confirmReadPost(post.id);
                            message.success(`Đã xác nhận! +${post.reward_points} xu`);
                        }}
                        icon={<CheckCircle size={14}/>}
                    >
                      Xác nhận (+{post.reward_points} Xu)
                    </Button>
                 </div>
              )}
               
               {/* Interaction Bar & Like Button */}
               <div className="flex items-center gap-4 py-4 border-t border-slate-100 mt-4 relative z-10">
                   <button 
                       onClick={() => toggleLikeAction(selectedPost!)}
                       className={`relative cursor-pointer flex items-center gap-2 px-4 py-2 rounded-full border transition active:scale-95 ${
                           selectedPost!.user_has_liked 
                           ? 'bg-red-50 border-red-200 text-red-600' 
                           : 'hover:bg-slate-50 border-slate-200 text-slate-600'
                       }`}
                   >
                       <ThumbsUp size={18} fill={selectedPost!.user_has_liked ? "currentColor" : "none"} />
                       <span className="font-bold">{selectedPost!.likes_count}</span> Yêu thích
                   </button>
               </div>

                {/* Comment Section */}
                <div className="bg-slate-50 p-6 border-t border-slate-200 rounded-lg mt-4">
                     <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                         <MessageSquare size={16}/> Bình luận ({comments.length})
                     </h3>
                     
                     <div className="space-y-4">
                         {comments.map((cmt: any) => (
                             <div key={cmt.id} className="flex gap-3">
                                 <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                     {cmt.users?.full_name?.[0] || 'U'}
                                 </div>
                                 <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex-1">
                                     <div className="flex justify-between items-baseline">
                                         <span className="font-bold text-xs text-slate-800">{cmt.users?.full_name || 'Người dùng'}</span>
                                         <span className="text-[10px] text-slate-400">{dayjs(cmt.created_at).format('HH:mm DD/MM')}</span>
                                     </div>
                                     <p className="text-sm text-slate-700 mt-1">{cmt.content}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>

            {/* Sticky Comment Input Footer - Cố định dưới cùng */}
            <div className="p-4 border-t border-slate-200 bg-white absolute bottom-0 left-0 right-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
               {post.is_locked ? (
                   <div className="flex items-center justify-center gap-2 text-slate-500 py-2 bg-slate-100 rounded border border-slate-200">
                       <Lock size={16} />
                       <span className="text-sm font-medium">Bình luận đã bị khóa</span>
                   </div>
               ) : (
                   <div className="relative">
                      <input 
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSend()}
                          disabled={sending}
                          type="text" 
                          placeholder="Viết bình luận..." 
                          className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-full focus:outline-none focus:border-blue-500 text-sm bg-slate-50 focus:bg-white transition-all shadow-sm" 
                      />
                      <button 
                          onClick={handleSend}
                          disabled={sending || !commentText.trim()}
                          className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-slate-300 transition"
                      >
                          <Send size={16}/>
                      </button>
                   </div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};