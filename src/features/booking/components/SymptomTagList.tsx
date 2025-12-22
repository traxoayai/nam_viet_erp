// src/features/booking/components/SymptomTagList.tsx
import React from 'react';
import { List, Tag, Checkbox, Button, Typography, Space } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { SelectedSymptom } from '../hooks/useSmartBooking';

interface SymptomTagListProps {
    symptoms: SelectedSymptom[];
    onRemove: (index: number) => void;
    onToggleUrgent: (index: number) => void;
}

const { Text } = Typography;

export const SymptomTagList: React.FC<SymptomTagListProps> = ({ symptoms, onRemove, onToggleUrgent }) => {
    if (symptoms.length === 0) return null;

    return (
        <div style={{ marginTop: 16 }}>
             <Text strong style={{ marginBottom: 8, display: 'block' }}>Triệu chứng đã chọn:</Text>
             <List
                size="small"
                bordered
                dataSource={symptoms}
                renderItem={(item, index) => (
                    <List.Item
                        actions={[
                           <Checkbox 
                                checked={item.isUrgent} 
                                onChange={() => onToggleUrgent(index)}
                            >
                                <span style={{ color: item.isUrgent ? '#ff4d4f' : 'inherit', fontWeight: item.isUrgent ? 'bold' : 'normal' }}>
                                    Khẩn cấp 🚨
                                </span>
                           </Checkbox>,
                           <Button 
                                type="text" 
                                danger 
                                icon={<CloseOutlined />} 
                                size="small" 
                                onClick={() => onRemove(index)} 
                           />
                        ]}
                    >
                        <Space>
                            <Tag color="cyan">{item.partId.toUpperCase()}</Tag>
                            <Text strong={item.isUrgent} type={item.isUrgent ? 'danger' : undefined}>
                                {item.note}
                            </Text>
                        </Space>
                    </List.Item>
                )}
             />
        </div>
    );
};
