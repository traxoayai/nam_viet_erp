// src/features/medical/components/DoctorBlock1_PatientInfo.tsx
import React, { useState } from 'react';
import { Card, Descriptions, Tag, Button } from 'antd';
import { UserOutlined, PhoneOutlined, HomeOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PatientHistoryDrawer } from './PatientHistoryDrawer';
import { ClinicalPrescriptionItem } from '../types/medical.types';

interface Props {
    patient: any;
    onCopyPrescription: (items: ClinicalPrescriptionItem[]) => void;
}

export const DoctorBlock1_PatientInfo: React.FC<Props> = ({ patient, onCopyPrescription }) => {
    const [openHistory, setOpenHistory] = useState(false);

    if (!patient) return <Card loading size="small" />;
    
    // Tính tuổi
    const age = patient.dob ? dayjs().diff(patient.dob, 'year') : 'N/A';
    
    return (
        <>
            <Card 
                size="small" 
                className="shadow-sm border border-gray-200 bg-white rounded-lg"
                title={<span className="text-blue-700 font-bold uppercase"><UserOutlined /> Hành chính</span>}
                extra={
                    <Button 
                        icon={<HistoryOutlined />} 
                        onClick={() => setOpenHistory(true)}
                        type="default"
                        className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                    >
                        Lịch sử khám
                    </Button>
                }
            >
                <Descriptions column={4} size="small" contentStyle={{ fontWeight: 500 }}>
                    <Descriptions.Item label="Họ tên"><span className="text-lg text-blue-900 font-bold">{patient.name}</span></Descriptions.Item>
                    <Descriptions.Item label="Mã BN"><Tag color="blue">{patient.code || 'N/A'}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Tuổi">{age} (Sinh: {patient.dob ? dayjs(patient.dob).format('DD/MM/YYYY') : '?'})</Descriptions.Item>
                    <Descriptions.Item label="Giới tính">{patient.gender === 'male' ? 'Nam' : 'Nữ'}</Descriptions.Item>
                    
                    <Descriptions.Item label="SĐT"><span className="flex items-center gap-1"><PhoneOutlined /> {patient.phone || '---'}</span></Descriptions.Item>
                    <Descriptions.Item label="Địa chỉ" span={2}><span className="flex items-center gap-1"><HomeOutlined /> {patient.address || '---'}</span></Descriptions.Item>
                    <Descriptions.Item label="Nhóm máu"><Tag color="red">{patient.blood_type || '?'}</Tag></Descriptions.Item>
                </Descriptions>
            </Card>

            {/* HISTORY DRAWER */}
            {patient && (
                <PatientHistoryDrawer 
                    open={openHistory}
                    onClose={() => setOpenHistory(false)}
                    patientId={patient.id}
                    patientName={patient.name}
                    onCopyPrescription={onCopyPrescription}
                />
            )}
        </>
    );
};
