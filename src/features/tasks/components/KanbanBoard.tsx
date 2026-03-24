import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task } from '../api/taskService';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { Spin } from 'antd';

const COLUMNS = [
  { id: 'todo', title: 'Danh sách Việc' },
  { id: 'doing', title: 'Đang thực hiện' },
  { id: 'done', title: 'Hoàn thành' },
  { id: 'cancelled', title: 'Đã hủy' },
];

interface Props {
  initialTasks: Task[];
  isLoading: boolean;
  onTaskClick?: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

export const KanbanBoard: React.FC<Props> = ({ initialTasks, isLoading, onTaskClick, onStatusChange }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    if (initialTasks) setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    if (isActiveTask && isOverColumn) {
      setTasks(tasks => {
        const activeIndex = tasks.findIndex(t => t.id === activeId);
        const overColumnId = over.data.current?.columnId;
        if (tasks[activeIndex].status !== overColumnId) {
          const newTasks = [...tasks];
          newTasks[activeIndex].status = overColumnId;
          return newTasks;
        }
        return tasks;
      });
    }

    if (isActiveTask && isOverTask) {
      setTasks(tasks => {
        const activeIndex = tasks.findIndex(t => t.id === activeId);
        const overIndex = tasks.findIndex(t => t.id === overId);

        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          const newTasks = [...tasks];
          newTasks[activeIndex].status = tasks[overIndex].status;
          return arrayMove(newTasks, activeIndex, overIndex);
        }
        return arrayMove(tasks, activeIndex, overIndex);
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const activeTaskFinal = tasks.find(t => t.id === taskId);
    const initialTask = initialTasks.find(t => t.id === taskId);

    if (activeTaskFinal && initialTask && activeTaskFinal.status !== initialTask.status) {
      // API Call via Optimistic Mutation provided by Props
      onStatusChange(taskId, activeTaskFinal.status);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-[calc(100vh-100px)]"><Spin size="large" /></div>;

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-x-auto bg-gradient-to-br from-gray-50 to-gray-200">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={tasks.filter(t => t.status === col.id)}
            onTaskClick={onTaskClick}
          />
        ))}
        {/* Render overlay for drag animation */}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
