// src/features/medical/components/PatientHistoryDrawer.tsx
import React from 'react';
import { Drawer, Timeline, Card, Tag, Button, Empty } from 'antd';
import { ClockCircleOutlined, MedicineBoxOutlined, CopyOutlined, UserOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePatientHistory } from '../hooks/usePatientHistory';
import { ClinicalPrescriptionItem } from '../types/medical.types';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId?: number;
  patientName?: string;
  onCopyPrescription: (items: ClinicalPrescriptionItem[]) => void;
}

export const PatientHistoryDrawer: React.FC<Props> = ({ open, onClose, patientId, patientName, onCopyPrescription }) => {
  const { history, loading } = usePatientHistory(patientId);

  return (
    <Drawer
      title={<span className="text-lg">Lịch sử khám bệnh: <b className="text-blue-700">{patientName}</b></span>}
      placement="right"
      width={800}
      onClose={onClose}
      open={open}
      bodyStyle={{ padding: '24px', backgroundColor: '#f0f2f5' }}
    >
      {loading ? (
         <Card loading />
      ) : history.length === 0 ? (
         <Empty description="Bệnh nhân chưa có lịch sử khám" />
      ) : (
        // [FIX]: Bỏ mode="left" để Timeline hiển thị kiểu cổ điển (Line bên trái, Content bên phải full width)
        <Timeline className="mt-2">
          {history.map((visit) => (
            <Timeline.Item 
                key={visit.id} 
                dot={<ClockCircleOutlined style={{ fontSize: '18px', color: '#1890ff' }} />}
            >
              <Card 
                size="small" 
                className="mb-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500 rounded-lg overflow-hidden"
                // [FIX]: Đưa thời gian vào Title của Card thay vì label của Timeline
                title={
                    <div className="flex flex-col gap-1 py-1">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-800 text-lg">
                                {visit.diagnosis || "Chưa có chẩn đoán"}
                            </span>
                            <div className="flex items-center text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-xs">
                                <CalendarOutlined className="mr-1"/>
                                {dayjs(visit.created_at).format('DD/MM/YYYY HH:mm')}
                            </div>
                        </div>
                        <div className="text-xs font-normal text-gray-500 flex items-center gap-1">
                            <UserOutlined /> Bác sĩ: <b>{visit.doctor?.full_name || "N/A"}</b>
                        </div>
                    </div>
                }
              >
                {/* 1. BODY: TRIỆU CHỨNG & LÂM SÀNG */}
                <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-100">
                    <div className="mb-2 text-sm text-gray-800">
                        <span className="font-semibold text-blue-900">Lý do khám / Triệu chứng:</span> 
                        <span className="ml-1">{visit.symptoms}</span>
                    </div>
                    {visit.examination_summary && (
                         <div className="text-sm text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                            {visit.examination_summary}
                         </div>
                    )}
                </div>

                {/* 2. LỜI DẶN */}
                {visit.doctor_notes && (
                    <div className="mb-4">
                        <div className="text-xs font-bold text-orange-600 uppercase mb-1 flex items-center gap-1">
                            <FileTextOutlined /> Lời dặn của bác sĩ
                        </div>
                        <div className="bg-orange-50 p-3 rounded-md border border-orange-100 text-gray-800 text-sm italic leading-relaxed">
                            {visit.doctor_notes}
                        </div>
                    </div>
                )}

                {/* 3. FOOTER: DANH SÁCH THUỐC */}
                {visit.flatMedicines && visit.flatMedicines.length > 0 ? (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                         <div className="flex justify-between items-center mb-3">
                            <div className="font-bold text-teal-700 flex items-center gap-2">
                                <MedicineBoxOutlined /> Đơn thuốc ({visit.flatMedicines.length})
                            </div>
                            <Button 
                                size="small" 
                                type="primary"
                                ghost
                                icon={<CopyOutlined />} 
                                onClick={() => {
                                    onCopyPrescription(visit.flatMedicines);
                                    onClose(); 
                                }}
                            >
                                Tái kê đơn này
                            </Button>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {visit.flatMedicines.map((p: any, idx: number) => (
                                 <div key={idx} className="flex justify-between items-start bg-teal-50/50 p-2 rounded border border-teal-100">
                                     <div className="flex-1 mr-2">
                                         <div className="font-medium text-gray-800 text-sm">{p.product_name}</div>
                                         {p.usage_note && <div className="text-xs text-gray-500 italic mt-0.5">{p.usage_note}</div>}
                                     </div>
                                     <Tag color="teal" className="m-0 font-bold bg-white border-teal-200 text-teal-700 shrink-0">
                                         {p.quantity} {p.unit_name}
                                     </Tag>
                                 </div>
                             ))}
                         </div>
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1 border-t border-gray-100 pt-2">
                        <MedicineBoxOutlined /> Không kê đơn thuốc nào
                    </div>
                )}
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Drawer>
  );
};