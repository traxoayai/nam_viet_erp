// src/pages/hr/TaskKanbanPage.tsx
import React, { useState } from 'react';
import { KanbanBoard } from '@/features/tasks/components/KanbanBoard';
import { CreateTaskModal } from '@/features/tasks/components/CreateTaskModal';
import { TaskDetailDrawer } from '@/features/tasks/components/TaskDetailDrawer';
import { useTaskBoard } from '@/features/tasks/hooks/useTaskBoard';
import { Task } from '@/features/tasks/api/taskService';
import { Button, Input, Select } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';

const TaskKanbanPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const { 
    tasks, 
    originalTasks, 
    isLoading, 
    updateStatusMutation, 
    updateTaskMutation, 
    filters, 
    setFilters 
  } = useTaskBoard();
  
  // Get unique assignees from original tasks for the filter dropdown
  const assignees = Array.from(new Set(originalTasks.map(t => t.assignee_id))).map(id => {
    const task = originalTasks.find(t => t.assignee_id === id);
    return { label: task?.assignee_name || id, value: id };
  });

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center z-10 w-full">
        <div>
          <h2 className="text-xl font-bold text-gray-800 m-0">Giao Việc & Theo Dõi Tiến Độ (Kanban)</h2>
          <div className="text-sm text-gray-500">
            Kéo thả thẻ công việc để thay đổi trạng thái và Cập nhật tiến độ
          </div>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg font-medium shadow-md"
        >
          Giao Việc Mới
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-200 flex items-center gap-4 shadow-sm z-0">
        <Input
          placeholder="Tìm tên công việc..."
          prefix={<SearchOutlined className="text-gray-400" />}
          className="w-64 rounded-lg"
          value={filters.keyword}
          onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
          allowClear
        />
        <Select
          placeholder="Tất cả nhân viên"
          className="w-48 rounded-lg"
          options={[{label: 'Tất cả nhân viên', value: ''}, ...assignees]}
          value={filters.assignee_id || ''}
          onChange={(v) => setFilters(f => ({ ...f, assignee_id: v }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
        />
        <Select
          placeholder="Tất cả mức độ"
          className="w-40 rounded-lg"
          options={[
            { label: 'Tất cả mức độ', value: '' },
            { label: 'Khẩn cấp (Urgent)', value: 'urgent' },
            { label: 'Cao (High)', value: 'high' },
            { label: 'Trung bình (Medium)', value: 'medium' },
            { label: 'Thấp (Low)', value: 'low' },
          ]}
          value={filters.priority || ''}
          onChange={(v) => setFilters(f => ({ ...f, priority: v }))}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard 
          initialTasks={tasks} 
          isLoading={isLoading}
          onTaskClick={setSelectedTask}
          onStatusChange={(taskId, newStatus) => updateStatusMutation.mutate({ taskId, newStatus })}
        />
      </div>
      
      <CreateTaskModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <TaskDetailDrawer 
        task={selectedTask} 
        onClose={() => setSelectedTask(null)} 
        onUpdate={async (taskId, updates) => {
           await updateTaskMutation.mutateAsync({ taskId, updates });
           setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, ...updates } : prev);
        }} 
      />
    </div>
  );
};

export default TaskKanbanPage;
