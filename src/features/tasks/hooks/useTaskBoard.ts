//src/features/tasks/hooks/useTaskBoard.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTasks, updateTaskStatus, createTask, updateTask, Task } from "../api/taskService";
import { message } from "antd";
import { useState, useMemo } from "react";

export const useTaskBoard = () => {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    keyword: '',
    assignee_id: '',
    priority: ''
  });

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string, newStatus: Task['status'] }) => 
      updateTaskStatus(taskId, newStatus),
    onMutate: async ({ taskId, newStatus }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      queryClient.setQueryData<Task[]>(['tasks'], old => {
        if (!old) return [];
        return old.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        );
      });

      return { previousTasks };
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
          queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      message.error("Cập nhật trạng thái thất bại, hệ thống tự động Rollback! Lỗi: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onSuccess: (data: any, { newStatus }) => {
       if (newStatus === 'done' && data?.kpi_points) {
         message.success(`Hoàn thành xuất sắc! +${data.kpi_points} KPI points vào Ví thi đua.`, 3);
       }
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      message.success('Đã giao việc thành công!');
    },
    onError: (err) => message.error('Lỗi tạo công việc: ' + err.message)
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string, updates: Partial<Task> }) => 
      updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      message.success('Cập nhật thành công!');
    },
    onError: (err) => message.error('Lỗi cập nhật: ' + err.message)
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchKeyword = !filters.keyword || t.title.toLowerCase().includes(filters.keyword.toLowerCase()) || t.description?.toLowerCase().includes(filters.keyword.toLowerCase());
      const matchAssignee = !filters.assignee_id || t.assignee_id === filters.assignee_id;
      const matchPriority = !filters.priority || t.priority === filters.priority;
      return matchKeyword && matchAssignee && matchPriority;
    });
  }, [tasks, filters]);

  return {
    tasks: filteredTasks,
    originalTasks: tasks,
    isLoading,
    error,
    updateStatusMutation,
    createTaskMutation,
    updateTaskMutation,
    filters,
    setFilters
  };
};
