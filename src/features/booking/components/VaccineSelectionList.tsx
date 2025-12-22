// src/features/booking/components/VaccineSelectionList.tsx
import React, { useEffect } from 'react';
import { List, Card, Input, Button, Typography, Tag } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useBookingResources, BookingVaccine } from '../hooks/useBookingResources';

const { Text } = Typography;

interface VaccineSelectionListProps {
    onSelect: (vaccine: BookingVaccine) => void;
}

export const VaccineSelectionList: React.FC<VaccineSelectionListProps> = ({ onSelect }) => {
    const { vaccines, loading, actions } = useBookingResources();

    useEffect(() => {
        actions.fetchVaccines();
    }, []);

    const handleSearch = (val: string) => {
        actions.fetchVaccines(val);
    };

    return (
        <div style={{ marginTop: 16 }}>
             <Input 
                placeholder="Tìm vắc-xin theo tên hoặc mã..." 
                prefix={<SearchOutlined />} 
                onChange={(e) => handleSearch(e.target.value)}
                style={{ marginBottom: 16 }}
            />
            
            <List
                grid={{ gutter: 16, column: 2 }}
                dataSource={vaccines}
                loading={loading}
                renderItem={(item) => (
                    <List.Item>
                        <Card 
                            size="small"
                            hoverable
                            onClick={() => onSelect(item)}
                            style={{ cursor: 'pointer', border: '1px solid #d9d9d9' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Text strong>{item.name}</Text>
                                    <div>
                                        <Tag color="blue">{item.sku}</Tag>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Text type="success" strong>
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                                    </Text>
                                    <div style={{ marginTop: 4 }}>
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            ghost 
                                            icon={<PlusOutlined />}
                                            onClick={(e) => {
                                                e.stopPropagation(); // prevent card click
                                                onSelect(item);
                                            }}
                                        >
                                            Chọn
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
        </div>
    );
};
