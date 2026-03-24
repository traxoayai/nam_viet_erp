import { supabase } from "@/shared/lib/supabaseClient";

export interface Task {
  id: string; // UUID
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  assigner_id: string | null; 
  assignee_id: string;
  
  entity_type: 'order' | 'customer' | 'product' | 'inventory_batch' | 'none';
  entity_id: string | null; 
  
  due_date: string; 
  completed_at: string | null;
  kpi_points: number; 
  
  ai_metadata: Record<string, any>;
  created_at: string;

  // Polymorphic properties for vw_task_board
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  assigner_name?: string | null;
  assigner_avatar?: string | null;
}

export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('vw_task_board')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Task[];
};

export const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId)
    .select('kpi_points, completed_at')
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTask = async (taskData: Partial<Task>) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([taskData])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};
