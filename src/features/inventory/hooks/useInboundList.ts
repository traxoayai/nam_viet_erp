import { useEffect } from "react";
import { useInboundStore } from "../stores/useInboundStore";
//import { InboundFilter } from "../types/inbound"; // Import Filter type if needed for direct exposure

export const useInboundList = () => {
  const {
    tasks,
    totalCount,
    loading,
    filters,
    fetchTasks,
    setFilters,
    setPage,
  } = useInboundStore();

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSearch = (search: string) => {
    setFilters({ search });
  };

  const handleStatusChange = (status: string) => {
    setFilters({ status });
  };

  const handleDateChange = (dates: any) => {
     setFilters({
         date_from: dates ? dates[0]?.toISOString() : undefined,
         date_to: dates ? dates[1]?.toISOString() : undefined
     });
  };

  const refreshList = () => {
    fetchTasks();
  };

  return {
    tasks,
    totalCount,
    loading,
    filters,
    setPage,
    handleSearch,
    handleStatusChange,
    handleDateChange,
    refreshList
  };
};
