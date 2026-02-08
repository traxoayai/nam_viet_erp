// src/features/connect/components/ConnectDetailDrawer.tsx
import { 
  X, Calendar, Clock, Shield, CheckCircle, 
  AlertTriangle, Download, FileText, Send, Lock 
} from 'lucide-react';
import { useConnectStore } from '../hooks/useConnectStore';
import dayjs from 'dayjs';
import { Button, message } from 'antd';
import { useEffect, useState } from 'react';

export const ConnectDetailDrawer = () => {
  const { selectedPost, setSelectedPost, confirmReadPost } = useConnectStore();
  const [isVisible, setIsVisible] = useState(false);

  // Hiệu ứng mở mượt mà (Giữ DOM, chỉ thay đổi class)
  useEffect(() => {
    if (selectedPost) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300); // Đợi animation đóng xong mới ẩn
      return () => clearTimeout(timer);
    }
  }, [selectedPost]);

  // Nếu không có post và animation đã đóng -> Không render gì cả (Tiết kiệm DOM)
  if (!selectedPost && !isVisible) return null;

  // Dữ liệu hiển thị (Lấy từ selectedPost hoặc giữ lại data cũ lúc đang đóng để không bị nháy)
  const post = selectedPost; 

  return (
    <div className="relative z-50">
      {/* Backdrop (Lớp mờ đen) - Fix lỗi full màn hình */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 ${
          selectedPost ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSelectedPost(null)}
      ></div>

      {/* Drawer Panel - Fix lỗi chiều cao & Animation */}
      <div 
        className={`fixed top-0 right-0 h-screen w-[50%] bg-white shadow-2xl transform transition-transform duration-300 ease-out border-l border-slate-200 flex flex-col ${
          selectedPost ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {post && (
          <>
            {/* Header */}
            <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                 <span className="flex items-center gap-1"><Calendar size={12}/> {dayjs(post.created_at).format('DD/MM/YYYY')}</span>
                 <span className="flex items-center gap-1"><Clock size={12}/> {dayjs(post.created_at).format('HH:mm')}</span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full text-slate-600 transition">
                <X size={18} />
              </button>
            </div>

            {/* Content Full Height */}
            <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-white">
              <h1 className="text-2xl font-bold text-slate-900 leading-snug mb-6">{post.title}</h1>

              {/* Author Box */}
              <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-md border border-slate-100">
                 <div className={`w-10 h-10 rounded flex items-center justify-center text-white font-bold ${post.is_anonymous ? 'bg-purple-600' : 'bg-blue-600'}`}>
                    {post.is_anonymous ? <Shield size={20}/> : (post.author_name?.[0] || 'A')}
                 </div>
                 <div className="flex-1">
                    <div className="font-bold text-slate-800 text-sm">
                        {/* Logic hiển thị tên: Nếu ẩn danh -> Luôn hiện "Người giấu tên" */}
                        {post.is_anonymous ? 'Người giấu tên' : post.author_name}
                    </div>
                    <div className="text-xs text-slate-500">{post.role}</div>
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
                     {post.attachments.map((file: any, idx: number) => (
                         <div key={idx} className="flex items-center gap-3 p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer w-fit transition">
                            <FileText size={20} className="text-red-500"/>
                            <div className="text-sm font-medium text-slate-800">{file.name}</div>
                            <Download size={16} className="text-slate-400 ml-2" />
                         </div>
                     ))}
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
            </div>

            {/* Comment Section */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
               {post.is_locked ? (
                   <div className="flex items-center justify-center gap-2 text-slate-500 py-2 bg-slate-100 rounded border border-slate-200">
                       <Lock size={16} />
                       <span className="text-sm font-medium">Bình luận đã bị khóa</span>
                   </div>
               ) : (
                   <div className="relative">
                      <input type="text" placeholder="Viết bình luận..." className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-sm focus:outline-none focus:border-blue-500 text-sm bg-white" />
                      <button className="absolute right-2 top-2 p-1 text-blue-600 hover:bg-blue-50 rounded"><Send size={16}/></button>
                   </div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};