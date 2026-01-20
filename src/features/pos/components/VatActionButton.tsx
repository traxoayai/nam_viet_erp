import React, { useState } from 'react';
import { Button, Space, Tag, Modal, message, Tooltip } from 'antd';
import { FileExcelOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '@/shared/lib/supabaseClient';
import { VatInvoiceModal } from './modals/VatInvoiceModal';

interface Props {
    invoice: {
        id: number;
        code: string;
        status: string; // 'pending' | 'processing' | 'issued' | 'verified'
        items_json?: any;
    };
    orderItems: any[];
    customer: any;
    onUpdate?: () => void;
}

export const VatActionButton: React.FC<Props> = ({ invoice, orderItems, customer, onUpdate }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleUpdateStatus = async (newStatus: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('sales_invoices')
                .update({ status: newStatus })
                .eq('id', invoice.id);

            if (error) throw error;

            message.success(newStatus === 'issued' ? 'Đã xác nhận xuất hóa đơn!' : 'Đã cập nhật trạng thái!');
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error(err);
            message.error("Lỗi cập nhật trạng thái: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmIssue = () => {
        Modal.confirm({
            title: 'Xác nhận Đã Xuất Hóa Đơn?',
            content: 'Hệ thống sẽ trừ kho VAT tương ứng với số lượng trên hóa đơn. Hành động này không thể hoàn tác!',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: () => handleUpdateStatus('issued')
        });
    };

    // 1. Trạng thái: Đã xuất (Issued / Verified)
    if (['issued', 'verified'].includes(invoice.status)) {
        return <Tag color="success" icon={<CheckCircleOutlined />}>Đã xuất VAT</Tag>;
    }

    // 2. Trạng thái: Đang xử lý (Đã tải file excel)
    if (invoice.status === 'processing') {
        return (
            <Space>
                <Tooltip title="Tải lại file Excel">
                    <Button 
                        icon={<FileExcelOutlined />} 
                        onClick={() => setIsModalOpen(true)}
                        size="small"
                    >
                        Tải lại
                    </Button>
                </Tooltip>
                
                <Button 
                    type="primary" 
                    icon={<CheckCircleOutlined />} 
                    onClick={handleConfirmIssue}
                    loading={loading}
                    size="small"
                >
                    Xác nhận Đã xuất
                </Button>

                <VatInvoiceModal 
                    visible={isModalOpen} 
                    onCancel={() => setIsModalOpen(false)}
                    orderItems={orderItems || []}
                    customer={customer}
                    onOk={() => {
                        // Re-download ko đổi status, giữ nguyên processing
                    }}
                />
            </Space>
        );
    }

    // 3. Trạng thái: Chưa xuất (Pending / New)
    return (
        <>
            <Button 
                type="default" 
                style={{ color: '#52c41a', borderColor: '#52c41a' }}
                icon={<FileExcelOutlined />} 
                onClick={() => setIsModalOpen(true)}
                size="small"
            >
                Xuất VAT
            </Button>

            <VatInvoiceModal 
                visible={isModalOpen} 
                onCancel={() => setIsModalOpen(false)}
                orderItems={orderItems || []}
                customer={customer}
                onOk={() => {
                    handleUpdateStatus('processing');
                }}
            />
        </>
    );
};
