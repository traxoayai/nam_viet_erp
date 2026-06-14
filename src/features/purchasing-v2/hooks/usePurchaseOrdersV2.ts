import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";

import { purchaseOrderV2Service } from "../services/purchaseOrderV2Service";
import { PurchaseOrderV2 } from "../types";

export const usePurchaseOrdersV2 = (searchTerm?: string) => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const query = useQuery<PurchaseOrderV2[]>({
    queryKey: ["purchase_orders_v2", searchTerm],
    queryFn: () => purchaseOrderV2Service.getList(searchTerm),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      purchaseOrderV2Service.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders_v2"] });
      message.success("Cập nhật trạng thái thành công!");
    },
    onError: (error: unknown) => {
      message.error("Lỗi: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, hardDelete }: { id: number; hardDelete: boolean }) =>
      purchaseOrderV2Service.delete(id, hardDelete),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders_v2"] });
      message.success(
        variables.hardDelete
          ? "Đã xóa cứng thành công!"
          : "Đã hủy đơn thành công!"
      );
    },
    onError: (error: unknown) => {
      message.error("Lỗi: " + error.message);
    },
  });

  return {
    ...query,
    updateStatus: updateStatusMutation.mutate,
    deleteOrder: deleteMutation.mutate,
  };
};
