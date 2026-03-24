import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../api/taskService';
import { TaskCard } from './TaskCard';

interface Props {
  id: string;
  title: string;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export const KanbanColumn: React.FC<Props> = ({ id, title, tasks, onTaskClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'Column', columnId: id }
  });

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col flex-1 min-w-[300px] p-4 rounded-2xl
        backdrop-blur-md bg-white/40 border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]
        transition-colors duration-200
        ${isOver ? 'bg-blue-50/50 border-blue-200' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="m-0 font-bold text-gray-700">{title}</h3>
        <span className="bg-white/60 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full">{tasks.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};
