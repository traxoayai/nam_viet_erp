// src/features/connect/pages/ConnectPage.tsx
import { useEffect, useState } from 'react';
import { Search, Plus, Bell, MessageSquare, FileText } from 'lucide-react';
import { useConnectStore } from '../hooks/useConnectStore';
import { ConnectList } from '../components/ConnectList';
import { ConnectDetailDrawer } from '../components/ConnectDetailDrawer';
import { CreatePostModal } from '../components/CreatePostModal';
import { Spin } from 'antd';

// Mock user role
const CURRENT_USER_ROLE = 'admin'; 

export const ConnectPage = () => {
  const { activeTab, setActiveTab, fetchPosts, loading, editingPost, setEditingPost } = useConnectStore();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  // Auto-open modal when editingPost is set
  useEffect(() => {
      if (editingPost) {
          setCreateModalOpen(true);
      }
  }, [editingPost]);

  // Handle Close Modal properly
  const handleCloseModal = () => {
      setCreateModalOpen(false);
      setEditingPost(null); // Reset to create mode
  };

  // Load data lần đầu
  useEffect(() => {
    fetchPosts(activeTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showCreateButton = activeTab === 'feedback' || (activeTab === 'news' && CURRENT_USER_ROLE === 'admin');

  // Helper render Tab
  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id 
          ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
          : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  );

  return (
    // [FIX] Bỏ h-screen, thay bằng h-full để fill vào Content Area của App Layout
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans text-[13px] relative">
      
      {/* --- 1. LOCAL HEADER (Thanh công cụ riêng của module này) --- */}
      {/* [FIX] Thêm border-t để tách biệt với Header chung của App nếu cần */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          {/* [FIX] Bỏ Logo chữ S vì App đã có Logo chung */}
          <h1 className="font-bold text-slate-700 text-lg">Cổng Thông Tin</h1>
          
          <div className="flex bg-slate-100 p-1 rounded-md">
            <TabButton id="news" label="Bảng Tin" icon={Bell} />
            <TabButton id="feedback" label="Góp Ý" icon={MessageSquare} />
            <TabButton id="docs" label="Văn Bản" icon={FileText} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1.5 text-slate-400" size={14} />
            <input type="text" placeholder="Tìm kiếm..." className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded text-xs w-64 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
          </div>
          
          {showCreateButton && (
            <button 
                onClick={() => { setEditingPost(null); setCreateModalOpen(true); }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition shadow-sm"
            >
                <Plus size={14}/> Tạo Mới
            </button>
          )}
        </div>
      </div>

      {/* --- 2. MAIN CONTENT (FULL LIST) --- */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
         {loading ? (
             <div className="flex-1 flex justify-center items-center"><Spin tip="Đang tải dữ liệu..." /></div>
         ) : (
             <ConnectList />
         )}
      </div>

      {/* --- 3. COMPONENTS --- */}
      <ConnectDetailDrawer />
      
      <CreatePostModal 
        open={isCreateModalOpen} 
        onClose={handleCloseModal} 
      />

    </div>
  );
};

export default ConnectPage;