import { useState, useEffect } from "react";
import { App } from "antd";
import { voucherService } from "../api/voucherService";
import { segmentationService } from "../api/segmentationService";

export const useVoucherDistribution = () => {
  const { message, notification } = App.useApp();
  
  const [promotions, setPromotions] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  
  const [loadingData, setLoadingData] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Load data ban đầu
  useEffect(() => {
    const initData = async () => {
      setLoadingData(true);
      try {
        const [promoData, segmentData] = await Promise.all([
          voucherService.getActivePromotions(),
          segmentationService.getSegments()
        ]);
        setPromotions(promoData || []);
        setSegments(segmentData || []);
      } catch (err) { console.error(err); } 
      finally { setLoadingData(false); }
    };
    initData();
  }, []);

  // Khi chọn voucher, load lịch sử phân phối của nó
  useEffect(() => {
    if (selectedPromoId) {
      voucherService.getDistributionHistory(selectedPromoId)
        .then(setHistory)
        .catch(console.error);
    } else {
      setHistory([]);
    }
  }, [selectedPromoId]);

  const handleDistribute = async () => {
    if (!selectedPromoId || !selectedSegmentId) {
      message.warning("Vui lòng chọn Voucher và Nhóm khách hàng");
      return;
    }

    setDistributing(true);
    try {
      // 1. Lấy thông tin hiển thị (UX)
      const promoName = promotions.find(p => p.id === selectedPromoId)?.name;
      const segmentName = segments.find(s => s.id === selectedSegmentId)?.name;

      // 2. Gọi API Phân phối
      const count = await voucherService.distributeToSegment(selectedPromoId, selectedSegmentId);

      // 3. Thông báo kết quả
      if (count > 0) {
        notification.success({
          message: "Phân phối thành công!",
          description: `Đã gửi voucher "${promoName}" vào ví của ${count} khách hàng thuộc nhóm "${segmentName}".`,
        });
        // Reload history
        const newHistory = await voucherService.getDistributionHistory(selectedPromoId);
        setHistory(newHistory);
      } else {
        notification.info({
          message: "Không có ai nhận được",
          description: "Có thể nhóm khách hàng này trống, hoặc tất cả thành viên trong nhóm đã có voucher này rồi.",
        });
      }
    } catch (err: any) {
      notification.error({
        message: "Lỗi phân phối",
        description: err.message
      });
    } finally {
      setDistributing(false);
    }
  };

  return {
    promotions, segments,
    selectedPromoId, setSelectedPromoId,
    selectedSegmentId, setSelectedSegmentId,
    loadingData, distributing, history,
    handleDistribute
  };
};
