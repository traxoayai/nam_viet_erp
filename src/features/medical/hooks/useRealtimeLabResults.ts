import { useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { notification } from 'antd';

interface Props {
  visitId: string | null;
  onResultReceived: () => void;
}

export const useRealtimeLabResults = ({ visitId, onResultReceived }: Props) => {
  useEffect(() => {
    if (!visitId) return;

    const channel = supabase
      .channel(`lab-results-${visitId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clinical_service_requests', // <--- TÊN BẢNG MỚI CHUẨN
          filter: `medical_visit_id=eq.${visitId}`,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Check if status changed to completed
          if (payload.new.status === 'completed' && payload.old.status !== 'completed') {
             notification.success({
                 message: 'Có kết quả xét nghiệm mới!',
                 description: 'Kết quả cận lâm sàng đã được cập nhật. Vui lòng kiểm tra.',
                 placement: 'bottomRight',
             });
             onResultReceived();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visitId]);
};
