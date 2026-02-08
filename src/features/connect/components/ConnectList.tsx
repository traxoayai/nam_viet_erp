// src/features/connect/components/ConnectList.tsx
import { 
  MessageSquare, Paperclip, 
  Edit, Trash2, Lock, Inbox, ThumbsUp 
} from 'lucide-react';
import { useConnectStore } from '../hooks/useConnectStore';
import dayjs from 'dayjs';
import { Modal, message } from 'antd';

export const ConnectList = () => {
  const { posts, selectedPost, setSelectedPost, activeTab, deletePost, toggleLockPost, setEditingPost, toggleLikeAction } = useConnectStore();

  const handleAction = (e: any, action: string, post: any) => {
      e.stopPropagation();
      
      if (action === 'delete') {
          Modal.confirm({
              title: 'Xóa bài đăng?',
              content: `Bạn có chắc muốn xóa "${post.title}" không? Hành động này không thể hoàn tác.`,
              okText: 'Xóa ngay',
              okType: 'danger',
              cancelText: 'Hủy',
              onOk: () => deletePost(post.id)
          });
      }
      if (action === 'edit') {
          setEditingPost(post);
      }
      if (action === 'lock') {
          const actionText = post.is_locked ? 'Mở khóa' : 'Khóa';
          toggleLockPost(post).then(() => message.success(`Đã ${actionText} thành công!`));
      }
  };

  const StatusBadge = ({ post }: { post: any }) => {
      const map: any = {
        high: { color: 'text-red-700 bg-red-50 border-red-200', text: 'Quan trọng' },
        normal: { color: 'text-blue-700 bg-blue-50 border-blue-200', text: 'Tin tức' },
        pending: { color: 'text-orange-700 bg-orange-50 border-orange-200', text: 'Chờ duyệt' },
        approved: { color: 'text-green-700 bg-green-50 border-green-200', text: 'Đã duyệt' },
      };
      let statusKey = post.priority === 'high' ? 'high' : 'normal';
      if (post.category === 'feedback') statusKey = post.status; 
      const conf = map[statusKey] || map.normal;
      return (
        <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-tight ${conf.color}`}>
          {conf.text}
        </span>
      );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white border-r border-slate-200">
      <div className="min-w-[800px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-10 text-center">#</th>
              <th className="px-4 py-3 w-32">Trạng thái</th>
              <th className="px-4 py-3">Tiêu đề & Tóm tắt</th>
              <th className="px-4 py-3 w-40">Người gửi</th>
              <th className="px-4 py-3 w-28 text-right">Tương tác</th>
              <th className="px-4 py-3 w-32 text-right">Thời gian</th>
              <th className="px-4 py-3 w-20 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.map((post, idx) => (
              <tr 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className={`cursor-pointer transition-colors group ${
                    selectedPost?.id === post.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                <td className="px-4 py-3">
                  <StatusBadge post={post} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    {post.is_pinned && <Paperclip size={12} className="text-slate-500 shrink-0"/>}
                    <span className={`text-sm font-bold truncate max-w-md ${post.category === 'news' && !post.is_read && post.must_confirm ? 'text-slate-900' : 'text-slate-700'}`}>
                      {post.title}
                    </span>
                    {activeTab === 'news' && post.must_confirm && !post.is_read && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full" title="Cần đọc"></div>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs truncate max-w-xl">{post.summary || '...'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                      {post.creator_avatar ? 
                         <img src={post.creator_avatar} alt="" className="w-6 h-6 rounded-full object-cover"/> 
                         : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">{post.creator_name?.charAt(0)}</div>
                       }
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700 text-xs">{post.creator_name}</span>
                        {post.is_anonymous && <span className="text-[10px] text-slate-400 italic">Ẩn danh</span>}
                      </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3 text-slate-400 text-xs">
                    <span title="Bình luận" className="flex items-center gap-1"><MessageSquare size={12}/> {post.comments_count}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleLikeAction(post);
                        }}
                        className={`flex items-center gap-1 hover:text-blue-600 transition ${post.user_has_liked ? 'text-blue-600 font-bold' : ''}`}
                        title="Thích"
                    >
                        <ThumbsUp size={12} fill={post.user_has_liked ? "currentColor" : "none"}/> {post.likes_count}
                    </button>
                    {post.attachments && post.attachments.length > 0 && <span title="Đính kèm" className="flex items-center gap-1 text-blue-500"><Paperclip size={12}/> {post.attachments.length}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                  {dayjs(post.created_at).format('DD/MM')} <br/> {dayjs(post.created_at).format('HH:mm')}
                </td>
                <td className="px-4 py-3 text-center">
                   {/* Nút hành động */}
                   <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleAction(e, 'edit', post)} className="p-1 hover:bg-blue-100 hover:text-blue-600 rounded" title="Sửa"><Edit size={14}/></button>
                      <button onClick={(e) => handleAction(e, 'lock', post)} className="p-1 hover:bg-orange-100 hover:text-orange-600 rounded" title={post.is_locked ? "Mở bình luận" : "Khóa bình luận"}>
                          {post.is_locked ? <Lock size={14} className="text-orange-600"/> : <Lock size={14}/>}
                      </button>
                      <button onClick={(e) => handleAction(e, 'delete', post)} className="p-1 hover:bg-red-100 hover:text-red-600 rounded" title="Xóa"><Trash2 size={14}/></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length === 0 && (
            <div className="p-12 text-center text-slate-400">
                <Inbox size={48} className="mx-auto mb-3 opacity-20"/>
                <p className="text-sm">Chưa có dữ liệu nào</p>
            </div>
        )}
      </div>
    </div>
  );
};