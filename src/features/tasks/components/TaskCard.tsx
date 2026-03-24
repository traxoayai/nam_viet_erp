import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../api/taskService';
import dayjs from 'dayjs';
import { ClockCircleOutlined, CheckCircleFilled } from '@ant-design/icons';
import { Tag, Avatar, Tooltip } from 'antd';

interface Props {
  task: Task;
  onClick?: () => void;
}

export const stripHtml = (html: string | null) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const priorityColors = {
  urgent: 'red',
  high: 'orange',
  medium: 'geekblue',
  low: 'default'
};

export const TaskCard: React.FC<Props> = ({ task, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.status !== 'done' && dayjs(task.due_date).isBefore(dayjs());

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        relative flex flex-col p-4 mb-3 bg-white rounded-xl cursor-grab active:cursor-grabbing
        border border-gray-100
        ${isDragging ? 'opacity-80 rotate-3 scale-105 shadow-2xl z-50 border-blue-400' : 'shadow-sm hover:shadow-md'}
        transition-all duration-200 ease-out
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="m-0 font-semibold text-gray-800 text-sm">{task.title}</h4>
        {task.status === 'done' && (
          <CheckCircleFilled className="text-green-500 text-lg animate-[ping_0.5s_ease-out_reverse]" />
        )}
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 mt-0">{stripHtml(task.description)}</p>
      )}
      
      <div className="flex items-center justify-between mt-auto">
        <Tag color={priorityColors[task.priority]} className="rounded-md border-none font-medium text-[11px] m-0">
          {task.priority.toUpperCase()}
        </Tag>
        <div className="flex items-center gap-2">
          {task.assignee_id && (
            <Tooltip title={task.assignee_name || 'Người nhận việc'}>
              <Avatar size="small" src={task.assignee_avatar} className="bg-blue-100 text-blue-600 border border-blue-200">
                 {task.assignee_name?.charAt(0) || 'U'}
              </Avatar>
            </Tooltip>
          )}
          <div className="flex items-center gap-1">
            <ClockCircleOutlined className={`text-xs ${isOverdue ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            <span className={`text-[11px] ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              {dayjs(task.due_date).format('DD/MM')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
