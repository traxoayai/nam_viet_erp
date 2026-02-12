
// src/features/medical/components/DoctorBlock1_PatientInfo.tsx
import React, { useState } from 'react';
import { Card, Tag, Button, Drawer, Timeline } from 'antd';
import { HistoryOutlined, AlertOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface Props {
  patient: any;
}

export const DoctorBlock1_PatientInfo: React.FC<Props> = ({ patient }) => {
  const [openHistory, setOpenHistory] = useState(false);

  if (!patient) return <Card loading />;

  const calculateAge = (dob: string) => {
      if(!dob) return 'N/A';
      return dayjs().year() - dayjs(dob).year();
  };

  return (
    <>
      <Card 
        size="small" 
        className="mb-4 sticky top-0 z-10 shadow-sm border-blue-100"
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div className="flex justify-between items-start">
            <div className="flex gap-4">
                 <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                        {patient.name?.charAt(0)}
                    </div>
                    <Tag color="geekblue" className="mt-1 mr-0">{patient.code}</Tag>
                 </div>
                 
                 <div>
                     <h3 className="text-lg font-bold text-gray-800 m-0">
                         {patient.name} 
                         <span className="text-sm font-normal text-gray-500 ml-2">({patient.gender === 'male' ? 'Nam' : 'Nữ'} - {calculateAge(patient.dob)} tuổi)</span>
                     </h3>
                     <div className="text-gray-500 text-xs mt-1">SĐT: {patient.phone} • Đ/C: {patient.address}</div>
                     
                     <div className="flex gap-2 mt-2">
                         {patient.medical_history && (
                            <Tag icon={<UserOutlined />} color="default">Tiền sử: {patient.medical_history}</Tag>
                         )}
                         {patient.allergies && (
                            <Tag icon={<AlertOutlined />} color="error">Dị ứng: {patient.allergies}</Tag>
                         )}
                     </div>
                 </div>
            </div>

            <Button 
                icon={<HistoryOutlined />} 
                onClick={() => setOpenHistory(true)}
            >
                Lịch sử khám
            </Button>
        </div>
      </Card>

      {/* Drawer History (Placeholder) */}
      <Drawer
        title={`Lịch sử khám bệnh - ${patient.name}`}
        placement="right"
        width={600}
        onClose={() => setOpenHistory(false)}
        open={openHistory}
      >
        <Timeline
            items={[
                {
                    color: 'green',
                    children: (
                        <>
                            <p className="font-bold">01/02/2026 - Viêm họng cấp</p>
                            <p>BS. Thảo - Đã kê đơn (Amoxicillin, Panadol)</p>
                        </>
                    ),
                },
                {
                    color: 'blue',
                    children: (
                        <>
                            <p className="font-bold">15/01/2026 - Khám tổng quát</p>
                            <p>Chỉ số bình thường</p>
                        </>
                    ),
                },
            ]}
        />
      </Drawer>
    </>
  );
};
