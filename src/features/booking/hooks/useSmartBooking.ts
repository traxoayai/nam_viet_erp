// src/features/booking/hooks/useSmartBooking.ts
import { useState } from 'react';
import { message } from 'antd';
import { bookingService } from '../api/bookingService';


export interface SelectedSymptom {
    partId: string;
    note: string;
    isUrgent: boolean;
}

export const useSmartBooking = () => {
    const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([]);
    const [activePartId, setActivePartId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mở menu chọn triệu chứng cho vùng cơ thể
    const selectPart = (partId: string) => {
        setActivePartId(partId === activePartId ? null : partId);
    };

    // Xác nhận thêm triệu chứng
    const addSymptom = (partId: string, note: string) => {
        const newItem: SelectedSymptom = {
            partId,
            note,
            isUrgent: false
        };
        setSelectedSymptoms(prev => [...prev, newItem]);
        setActivePartId(null); // Close menu
    };

    // Xóa triệu chứng đã chọn
    const removeSymptom = (index: number) => {
        setSelectedSymptoms(prev => prev.filter((_, i) => i !== index));
    };

    // Đánh dấu khẩn cấp
    const toggleUrgent = (index: number) => {
        setSelectedSymptoms(prev => prev.map((item, i) => 
            i === index ? { ...item, isUrgent: !item.isUrgent } : item
        ));
    };

    const resetBooking = () => {
        setSelectedSymptoms([]);
        setActivePartId(null);
    }

    // --- SUBMISSION ACTIONS ---

    // --- SUBMISSION ACTIONS ---

    const submitBooking = async (customerId: number, doctorId: string | undefined, time: string, notes: string, status: 'confirmed' | 'pending' = 'confirmed') => {
        setIsSubmitting(true);
        try {
            await bookingService.createBooking({
                customer_id: customerId,
                doctor_id: doctorId,
                appointment_time: time,
                symptoms: selectedSymptoms,
                notes: notes,
                description: "Booking from App UI",
                status: status
            });
            message.success("Đã tạo lịch hẹn thành công!");
            resetBooking();
            return true;
        } catch (error: any) {
            console.error(error);
            message.error(error.message || "Lỗi tạo lịch hẹn");
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitCheckIn = async (customerId: number, doctorId: string | undefined, notes: string) => {
        setIsSubmitting(true);
        try {
            // Auto-detect urgency
            const isUrgent = selectedSymptoms.some(s => s.isUrgent);
            
            const result = await bookingService.checkInNow({
                customer_id: customerId,
                doctor_id: doctorId,
                priority: isUrgent ? 'urgent' : 'normal',
                symptoms: selectedSymptoms,
                notes: notes
            });

            message.success(`Đã check-in thành công! Số thứ tự: ${result?.queue_number || 'N/A'}`);
            resetBooking();
            return true;
        } catch (error: any) {
            console.error(error);
            message.error(error.message || "Lỗi check-in");
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        selectedSymptoms,
        activePartId,
        selectPart,
        addSymptom,
        removeSymptom,
        toggleUrgent,
        resetBooking,
        isSubmitting,
        submitBooking,
        submitCheckIn
    };
};
