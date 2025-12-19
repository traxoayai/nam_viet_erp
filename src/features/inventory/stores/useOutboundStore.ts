import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { outboundService } from "../api/outboundService";
import { OutboundTask, OutboundStats, OutboundFilter } from "../types/outbound";

interface OutboundState {
  // Data State
  tasks: OutboundTask[];
  stats: OutboundStats;
  totalCount: number;
  loading: boolean;
  
  // Filter State
  filters: OutboundFilter;

  // Actions
  fetchTasks: () => Promise<void>;
  fetchStats: () => Promise<void>;
  
  setFilters: (partial: Partial<OutboundFilter>) => void;
  setPage: (page: number, pageSize: number) => void;
  
  updatePackageCount: (taskId: string, count: number) => Promise<void>;
  cancelTask: (taskId: string, reason: string) => Promise<void>;
}

const DEFAULT_FILTERS: OutboundFilter = {
  page: 1,
  pageSize: 10,
  search: "",
  status: "All",
};

export const useOutboundStore = create<OutboundState>()(
  devtools((set, get) => ({
    // Initial State
    tasks: [],
    stats: {
      pending_packing: 0,
      shipping: 0,
      completed_today: 0,
    },
    totalCount: 0,
    loading: false,
    filters: DEFAULT_FILTERS,

    // Actions
    fetchTasks: async () => {
      set({ loading: true });
      try {
        const { filters } = get();
        const { data, total } = await outboundService.getOutboundTasks(filters);
        set({ tasks: data, totalCount: total, loading: false });
      } catch (error) {
        set({ loading: false });
        // Handle error (optional: add error state)
      }
    },

    fetchStats: async () => {
       try {
          const stats = await outboundService.getOutboundStats(1); // Default ID
          set({ stats });
       } catch (error) {
          console.error(error);
       }
    },

    setFilters: (partial) => {
       set((state) => ({
          filters: { ...state.filters, ...partial, page: 1 } // Reset to page 1 on filter change
       }));
       get().fetchTasks();
    },

    setPage: (page, pageSize) => {
       set((state) => ({
          filters: { ...state.filters, page, pageSize }
       }));
       get().fetchTasks();
    },

    updatePackageCount: async (taskId, count) => {
       try {
          // Optimistic Update
          set((state) => ({
             tasks: state.tasks.map(t => 
                t.task_id === taskId ? { ...t, package_count: count } : t
             )
          }));
          
          await outboundService.updatePackageCount(taskId, count);
       } catch (error) {
          // Rollback or re-fetch on error
          get().fetchTasks();
       }
    },

    cancelTask: async (taskId, reason) => {
       await outboundService.cancelTask(taskId, reason);
       get().fetchTasks(); // Refresh list after cancel
       get().fetchStats(); // Refresh stats too
    },
  }))
);
