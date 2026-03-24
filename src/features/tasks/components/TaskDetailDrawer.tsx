import React, { useState, useEffect } from 'react';
import { Drawer, Button, Tag, Space, Avatar } from 'antd';
import TextEditor from '@/shared/ui/common/TextEditor';
import { Task } from '../api/taskService';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

interface Props {
  task: Task | null;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

export const TaskDetailDrawer: React.FC<Props> = ({ task, onClose, onUpdate }) => {
  const { user } = useAuthStore();
  const [description, setDescription] = useState(task?.description || '');

  useEffect(() => {
    setDescription(task?.description || '');
  }, [task]);

  if (!task) return null;

  const isAssigner = user?.id === task.assigner_id;
  const isAssignee = user?.id === task.assignee_id;

  const handleUpdateDescription = () => {
    onUpdate(task.id, { description });
  };

  const handleAccept = () => {
    onUpdate(task.id, { status: 'done' });
    onClose();
  };

  return (
    <Drawer
      title={<h3 className="text-2xl font-bold m-0">{task.title}</h3>}
      placement="right"
      width={700}
      onClose={onClose}
      open={!!task}
      extra={
        <Space>
          <Tag color="cyan" className="text-sm px-3 py-1 rounded-full">{task.status.toUpperCase()}</Tag>
        </Space>
      }
    >
      <div className="flex items-center gap-4 mb-6 bg-gray-50/80 p-5 rounded-2xl border border-gray-100">
        <Avatar size="large" src={task.assignee_avatar}>{task.assignee_name?.charAt(0) || 'U'}</Avatar>
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Người nhận việc</div>
          <div className="font-semibold text-gray-800 text-lg">{task.assignee_name || 'Đang cập nhật'}</div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 mb-3 text-lg">Chi tiết & Cập nhật tiến độ</h4>
        {(isAssigner || isAssignee) ? (
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <TextEditor
              value={description}
              onChange={setDescription}
              height={400}
            />
            <div className="bg-gray-50 p-4 text-right border-t border-gray-200 flex justify-end gap-3">
              <Button size="large" className="rounded-xl font-medium" onClick={() => setDescription(task.description || '')}>Hủy</Button>
              <Button type="primary" size="large" className="rounded-xl font-medium shadow-md" onClick={handleUpdateDescription}>Lưu cập nhật</Button>
            </div>
          </div>
        ) : (
          <div 
            className="prose max-w-none border border-gray-100 p-6 rounded-2xl bg-gray-50/50"
            dangerouslySetInnerHTML={{ __html: task.description || '' }}
          />
        )}
      </div>

      {isAssigner && task.status !== 'done' && (
        <div className="mt-8 border-t border-gray-100 pt-6 text-center">
          <Button type="primary" size="large" onClick={handleAccept} className="w-full h-14 rounded-2xl text-lg font-medium shadow-lg bg-green-500 hover:bg-green-600 border-none">
            ✅ Nghiệm Thu (Đóng Task)
          </Button>
        </div>
      )}
    </Drawer>
  );
};
