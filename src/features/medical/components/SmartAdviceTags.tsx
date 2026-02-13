// src/features/medical/components/SmartAdviceTags.tsx
import React, { useMemo } from 'react';
import { Tag, Tooltip } from 'antd';
import { PlusCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { ADVICE_TEMPLATES, DEFAULT_ADVICE } from '../constants/adviceKnowledge';

interface Props {
    diagnosis: string;
    currentNotes: string;
    onAddNote: (newNote: string) => void;
}

export const SmartAdviceTags: React.FC<Props> = ({ diagnosis, currentNotes, onAddNote }) => {

    // Logic cốt lõi: Phân tích Chẩn đoán -> Đưa ra Gợi ý
    const matchedSuggestions = useMemo(() => {
        if (!diagnosis || diagnosis.trim() === '') return DEFAULT_ADVICE;

        const diagLower = diagnosis.toLowerCase();
        let results: string[] = [];

        // Duyệt qua từ điển để tìm keyword khớp với chẩn đoán
        ADVICE_TEMPLATES.forEach(template => {
            // Nếu trong chẩn đoán có chứa bất kỳ keyword nào của nhóm này
            if (template.keywords.some(kw => diagLower.includes(kw))) {
                results = [...results, ...template.suggestions];
            }
        });

        // Nếu bác sĩ gõ bệnh lạ không có trong từ điển, trả về câu dặn chung chung
        if (results.length === 0) {
            return DEFAULT_ADVICE;
        }

        // Loại bỏ các câu trùng lặp (nếu bệnh nhân vừa đau dạ dày vừa đau khớp mà có câu trùng)
        return Array.from(new Set(results));
    }, [diagnosis]);

    // Hàm xử lý khi bác sĩ click vào 1 Tag
    const handleTagClick = (suggestion: string) => {
        // Kiểm tra xem câu này đã được add vào TextArea chưa để tránh add trùng
        if (currentNotes && currentNotes.includes(suggestion)) {
            return; // Đã có rồi thì bỏ qua
        }

        // Nếu TextArea đang có chữ, thêm dấu xuống dòng. Nếu trống thì viết luôn.
        // Dùng dấu gạch đầu dòng (bullet point) cho chuyên nghiệp
        const bulletPrefix = "- ";
        const newText = currentNotes 
            ? `${currentNotes.trim()}\n${bulletPrefix}${suggestion}` 
            : `${bulletPrefix}${suggestion}`;

        onAddNote(newText);
    };

    return (
        <div className="bg-blue-50/50 p-2 rounded border border-blue-100 mt-2">
            <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                <BulbOutlined /> Trợ lý AI: Gợi ý tư vấn ({matchedSuggestions.length})
            </div>
            
            <div className="flex flex-wrap gap-2">
                {matchedSuggestions.map((suggestion, index) => {
                    // Check xem câu này bác sĩ đã chọn chưa để đổi màu (Xám đi nếu đã chọn)
                    const isSelected = currentNotes && currentNotes.includes(suggestion);

                    return (
                        <Tooltip key={index} title={suggestion} mouseEnterDelay={0.5}>
                            <Tag 
                                className={`cursor-pointer border border-dashed py-1 px-2 transition-all ${
                                    isSelected 
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60' 
                                    : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-600 hover:text-white'
                                }`}
                                onClick={() => handleTagClick(suggestion)}
                            >
                                <PlusCircleOutlined className="mr-1" />
                                {/* Chỉ hiện 50 ký tự đầu cho gọn UI, trỏ chuột vào sẽ thấy full */}
                                {suggestion.length > 50 ? `${suggestion.substring(0, 50)}...` : suggestion}
                            </Tag>
                        </Tooltip>
                    );
                })}
            </div>
            <div className="text-[10px] text-gray-400 mt-2 italic">
                * Click vào thẻ để tự động điền vào ô Lời dặn bên trên. Gợi ý thay đổi tự động theo Chẩn đoán.
            </div>
        </div>
    );
};