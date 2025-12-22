// src/features/booking/components/BookingModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Row, Col, Select, Segmented, Input, Button, Card, Typography, Space, Divider, message, DatePicker } from 'antd';
import { UserOutlined, SearchOutlined, CalendarOutlined, ThunderboltOutlined, SaveOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSmartBooking } from '../hooks/useSmartBooking';
import { useBookingResources, BookingCustomer } from '../hooks/useBookingResources';
import { InteractiveBodyMap } from './InteractiveBodyMap';
import { SymptomTagList } from './SymptomTagList';
import { SYMPTOM_SUGGESTIONS } from '../constants/symptoms';
import { CustomerInfoCard } from './CustomerInfoCard';
import { QuickCustomerModal } from './QuickCustomerModal';
import { VaccineSelectionList } from './VaccineSelectionList';

const { Text } = Typography;
const { TextArea } = Input;

interface BookingModalProps {
    visible: boolean;
    onCancel: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ visible, onCancel }) => {
    // Logic Hook
    const { 
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
    } = useSmartBooking();

    // Resources Hook (Real Data)
    const { 
        customers, 
        doctors, 
        loading: loadingResources, 
        actions 
    } = useBookingResources();

    // Local Form State
    const [bookingType, setBookingType] = useState<string>('kham_benh');
    const [customSymptom, setCustomSymptom] = useState('');
    const [customerId, setCustomerId] = useState<number | undefined>(undefined);
    const [doctorId, setDoctorId] = useState<string | undefined>(undefined); // UUID is string
    const [notes, setNotes] = useState('');
    const [apptDate, setApptDate] = useState<dayjs.Dayjs | null>(dayjs());

    // UI State for Customer Modal
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<BookingCustomer> | undefined>(undefined);

    // Fetch resources on mount
    useEffect(() => {
        actions.fetchDoctors();
    }, []); // Empty dependency array (Run once on mount)

    // Compute selected customer for display
    const selectedCustomer = useMemo(() => 
        customers.find(c => c.id === customerId), 
    [customerId, customers]);

    const handleAddCustom = () => {
        if (activePartId && customSymptom.trim()) {
            addSymptom(activePartId, customSymptom.trim());
            setCustomSymptom('');
        }
    };

    const handleClose = () => {
        resetBooking();
        // Reset local state
        setCustomerId(undefined);
        setDoctorId(undefined);
        setNotes('');
        setBookingType('kham_benh');
        onCancel();
    };

    // --- HANDLERS ---
    
    const handleCreateBooking = async (status: 'confirmed' | 'pending') => {
        if (!customerId) {
            message.warning("Vui lòng chọn khách hàng!");
            return;
        }
        if (!apptDate) {
             message.warning("Vui lòng chọn thời gian hẹn!");
             return;
        }
        
        // Pass doctorId as string or undefined (API expects string | undefined/null)
        const success = await submitBooking(customerId, doctorId, apptDate.toISOString(), notes, status);
        if (success) handleClose();
    };

    const handleCheckInNow = async () => {
        if (!customerId) {
            message.warning("Vui lòng chọn khách hàng!");
            return;
        }
        const success = await submitCheckIn(customerId, doctorId, notes);
        if (success) handleClose();
    };

    // --- CUSTOMER MODAL HANDLERS ---
    const openCreateCustomer = () => {
        setEditingCustomer(undefined);
        setCustomerModalOpen(true);
    }

    const openEditCustomer = () => {
        if (selectedCustomer) {
            setEditingCustomer(selectedCustomer);
            setCustomerModalOpen(true);
        }
    }

    const handleCustomerSuccess = (newId?: number) => {
        // Reload customers list to get updated data
        actions.searchCustomers(''); 
        if (newId) {
            setCustomerId(newId);
        }
    }

    return (
        <Modal
            title={<Space><ThunderboltOutlined style={{ color: '#1890ff' }} /> Đặt Lịch Khám Bệnh Thông Minh</Space>}
            open={visible}
            onCancel={handleClose}
            width={1000}
            footer={[
                <Button key="cancel" onClick={handleClose} disabled={isSubmitting}>Hủy</Button>,
                <Button 
                    key="draft" 
                    icon={<SaveOutlined />} 
                    loading={isSubmitting}
                    onClick={() => handleCreateBooking('pending')}
                >
                    Lưu Nháp
                </Button>,
                <Button 
                    key="book" 
                    type="primary" 
                    icon={<CalendarOutlined />} 
                    loading={isSubmitting}
                    onClick={() => handleCreateBooking('confirmed')}
                >
                    Tạo Lịch
                </Button>,
                <Button 
                    key="checkin" 
                    type="primary" 
                    danger 
                    loading={isSubmitting}
                    onClick={handleCheckInNow}
                >
                    Check-in Ngay
                </Button>
            ]}
            destroyOnClose
        >
            <Row gutter={24}>
                {/* LEFT COLUMN: Customer & Basic Info */}
                <Col span={9} style={{ borderRight: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        
                        {/* 1. Customer Search */}
                        <div>
                             <Text strong>Khách hàng / Bệnh nhân <span style={{color: 'red'}}>*</span></Text>
                             <Select
                                showSearch
                                style={{ width: '100%', marginTop: 8 }}
                                placeholder="Tìm tên hoặc SĐT..."
                                optionFilterProp="children"
                                suffixIcon={loadingResources ? <ThunderboltOutlined spin /> : <SearchOutlined />}
                                onSearch={(val) => actions.searchCustomers(val)}
                                filterOption={false} // Handle filtering via API
                                onChange={(val) => setCustomerId(val)}
                                value={customerId}
                                options={customers.map(c => ({
                                    label: `${c.name} - ${c.phone}`,
                                    value: c.id
                                }))}
                                notFoundContent={loadingResources ? "Đang tìm..." : "Không tìm thấy"}
                            />
                            
                            {/* Customer Info Card */}
                            <CustomerInfoCard customer={selectedCustomer} />
                            
                            {/* Action Buttons */}
                            <Row gutter={8} style={{ marginTop: 8 }}>
                                <Col span={12}>
                                    <Button 
                                        size="small" 
                                        icon={<EditOutlined />} 
                                        block
                                        onClick={openEditCustomer}
                                        disabled={!selectedCustomer}
                                    >
                                        Sửa thông tin
                                    </Button>
                                </Col>
                                <Col span={12}>
                                    <Button 
                                        size="small" 
                                        type="dashed" 
                                        icon={<UserAddOutlined />} 
                                        block
                                        onClick={openCreateCustomer}
                                    >
                                        Thêm khách mới
                                    </Button>
                                </Col>
                            </Row>
                        </div>

                        {/* 2. Service Type */}
                        <div>
                            <Text strong>Loại dịch vụ</Text>
                            <div style={{ marginTop: 8 }}>
                                <Segmented 
                                    block
                                    options={[
                                        { label: 'Khám Bệnh', value: 'kham_benh', icon: <UserOutlined /> },
                                        { label: 'Tiêm Chủng', value: 'tiem_chung', icon: <ThunderboltOutlined /> },
                                    ]}
                                    value={bookingType}
                                    onChange={(val) => setBookingType(val as string)}
                                />
                            </div>
                        </div>

                         {/* 3. Date Time Picker (Only for Appointment) */}
                         <div>
                            <Text strong>Thời gian hẹn</Text>
                            <DatePicker 
                                showTime 
                                format="DD/MM/YYYY HH:mm"
                                style={{ width: '100%', marginTop: 8 }}
                                value={apptDate}
                                onChange={setApptDate}
                            />
                         </div>

                        {/* 4. Doctor Select */}
                        <div>
                            <Text strong>Bác sĩ phụ trách (Tùy chọn)</Text>
                            <Select
                                style={{ width: '100%', marginTop: 8 }}
                                placeholder="Chọn bác sĩ..."
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                onChange={(val) => setDoctorId(val)}
                                value={doctorId}
                                loading={loadingResources}
                                options={doctors.map(d => ({
                                    label: d.name,
                                    value: d.id // UUID string
                                }))}
                            />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />
                        
                        {/* 5. Notes */}
                        <div>
                            <Text strong>Ghi chú thêm</Text>
                            <TextArea 
                                rows={3} 
                                style={{ marginTop: 8 }} 
                                placeholder="Tiền sử bệnh, dị ứng..." 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </Col>

                {/* RIGHT COLUMN: Interactive Triage */}
                <Col span={15}>
                    { bookingType === 'kham_benh' ? (
                        <Row gutter={16}>
                            {/* ZONE 1: BODY MAP */}
                            <Col span={10}>
                                <Text strong style={{ marginBottom: 16, display: 'block', textAlign: 'center' }}>
                                    Vị trí đau / Triệu chứng
                                </Text>
                                <InteractiveBodyMap 
                                    selectedParts={selectedSymptoms.map(s => s.partId)}
                                    onPartClick={selectPart}
                                />
                            </Col>

                            {/* ZONE 2 & 3: CONTEXT & LIST */}
                            <Col span={14}>
                                {activePartId ? (
                                    <Card 
                                        size="small" 
                                        title={`Triệu chứng: ${activePartId.toUpperCase()}`} 
                                        style={{ marginBottom: 16, borderColor: '#1890ff', background: '#e6f7ff' }}
                                        extra={<Button size="small" type="text" onClick={() => selectPart(activePartId)}>Đóng</Button>}
                                    >
                                        <Space wrap>
                                            {(SYMPTOM_SUGGESTIONS[activePartId] || []).map(sym => (
                                                <Button 
                                                    key={sym} 
                                                    size="small" 
                                                    onClick={() => addSymptom(activePartId, sym)}
                                                >
                                                    {sym}
                                                </Button>
                                            ))}
                                        </Space>
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Space.Compact style={{ width: '100%' }}>
                                            <Input 
                                                placeholder="Khác..." 
                                                size="small" 
                                                value={customSymptom} 
                                                onChange={e => setCustomSymptom(e.target.value)}
                                                onPressEnter={handleAddCustom}
                                            />
                                            <Button type="primary" size="small" onClick={handleAddCustom}>Thêm</Button>
                                        </Space.Compact>
                                    </Card>
                                ) : (
                                    <div style={{ 
                                        height: 100, 
                                        background: '#fafafa', 
                                        border: '1px dashed #d9d9d9', 
                                        borderRadius: 8,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: '#999',
                                        marginBottom: 16
                                    }}>
                                        Chọn vùng cơ thể để thêm triệu chứng
                                    </div>
                                )}

                                {/* ZONE 3: Selected List */}
                                <SymptomTagList 
                                    symptoms={selectedSymptoms}
                                    onRemove={removeSymptom}
                                    onToggleUrgent={toggleUrgent}
                                />
                            </Col>
                        </Row>
                    ) : (
                        <VaccineSelectionList 
                             onSelect={(vaccine) => addSymptom('VACCINE', `${vaccine.name} (SKU: ${vaccine.sku}) - ${new Intl.NumberFormat('vi-VN').format(vaccine.price)}đ`)}
                        />
                    )}
                    
                </Col>
            </Row>

            {/* QUICK CUSTOMER MODAL */}
            <QuickCustomerModal 
                open={customerModalOpen}
                onCancel={() => setCustomerModalOpen(false)}
                onSuccess={handleCustomerSuccess}
                initialValues={editingCustomer}
            />
        </Modal>
    );
};
